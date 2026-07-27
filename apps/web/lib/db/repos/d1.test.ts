import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import * as schema from "./schema";
import type { Repositories } from "./types";

// Integration test for the Drizzle/D1 repository implementation. Since D1
// itself only runs inside Workers, this stands up a local SQLite database (via
// better-sqlite3) behind a minimal shim that satisfies the `D1Database`
// surface Drizzle's D1 driver calls (`prepare`/`bind`/`all`/`run`/`raw`,
// `batch`, `exec`) and applies the real wrangler migration to it. The
// assertions mirror `fakes.test.ts` — both implementations must behave
// identically.

const MIGRATION_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations/0001_init.sql",
);

function toD1Result<T>(
  results: T[],
  changes: number,
  lastInsertRowid: number | bigint,
): D1Result<T> {
  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: results.length,
      rows_written: changes,
      last_row_id: Number(lastInsertRowid),
      changed_db: changes > 0,
      changes,
    },
  } as D1Result<T>;
}

function createD1Shim(sqlite: Database.Database): D1Database {
  function prepare(query: string, params: unknown[] = []): D1PreparedStatement {
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => prepare(query, values),
      first: (async <T>(colName?: string) => {
        const row = sqlite.prepare(query).get(...params) as Record<string, unknown> | undefined;
        if (!row) return null;
        return (colName ? row[colName] : row) as T | null;
      }) as D1PreparedStatement["first"],
      run: (async <T>() => {
        if (/^\s*select/i.test(query)) {
          return toD1Result(sqlite.prepare(query).all(...params) as T[], 0, 0);
        }
        const info = sqlite.prepare(query).run(...params);
        return toD1Result([] as T[], info.changes, info.lastInsertRowid);
      }) as D1PreparedStatement["run"],
      all: (async <T>() =>
        toD1Result(
          sqlite.prepare(query).all(...params) as T[],
          0,
          0,
        )) as D1PreparedStatement["all"],
      raw: (async (options?: { columnNames?: boolean }) => {
        const handle = sqlite.prepare(query);
        const rows = handle.raw().all(...params) as unknown[];
        if (options?.columnNames) {
          const columns = handle.columns().map((column) => column.name);
          return [columns, ...rows];
        }
        return rows;
      }) as D1PreparedStatement["raw"],
    } as D1PreparedStatement;
    return statement;
  }

  return {
    prepare: (query: string) => prepare(query),
    batch: async (statements: D1PreparedStatement[]) => {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    exec: async (query: string) => {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    dump: async () => {
      throw new Error("dump() is not supported by the test D1 shim");
    },
    withSession: () => {
      throw new Error("withSession() is not supported by the test D1 shim");
    },
  } as unknown as D1Database;
}

async function seedDatabase(sqlite: Database.Database, now: Date): Promise<void> {
  const seed = buildSeed(now);
  const orm = drizzle(createD1Shim(sqlite), { schema });
  // Sequential (not Promise.all) — child rows have foreign keys onto parents
  // inserted earlier in this list.
  await orm.insert(schema.studios).values(seed.studio);
  await orm.insert(schema.studioSettings).values(seed.settings);
  await orm.insert(schema.members).values(seed.members);
  await orm.insert(schema.classTypes).values(seed.classTypes);
  await orm.insert(schema.classSessions).values(seed.sessions);
  await orm.insert(schema.bookings).values(seed.bookings);
  await orm.insert(schema.invoices).values(seed.invoices);
  await orm.insert(schema.invoiceLineItems).values(seed.lineItems);
  await orm.insert(schema.notificationOutbox).values(seed.outbox);
}

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(readFileSync(MIGRATION_PATH, "utf8"));
    await seedDatabase(sqlite, NOW);
    repos = createD1Repositories(createD1Shim(sqlite));
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(members.length).toBeGreaterThan(0);
  });

  it("finds a member by email within the studio", async () => {
    const found = await repos.members.findByEmail(studioId, "amara@example.com");
    expect(found?.name).toBe("Amara Okafor");
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
  });

  it("inserts then reads back by id", async () => {
    const member = {
      id: "mem_new",
      studioId,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("update writes through and reads back the patched row", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    await repos.members.update(target.id, { status: "paused" });
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("empty session id list returns no bookings without querying", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("empty line items insert is a no-op", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });
});
