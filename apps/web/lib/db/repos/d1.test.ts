import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import {
  createD1Repositories,
  type D1Database,
  type D1PreparedStatement,
  type D1Result,
} from "./d1";
import type { SeedData } from "./fakes";
import { toSnakeKey } from "./mapping";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Local stand-in for the D1 binding, over Node's built-in in-memory SQLite
// (node:sqlite — zero extra dependencies, and the same SQLite dialect D1
// runs). It implements just the D1Database surface the Drizzle adapter uses,
// so this suite exercises the real production code path — schema, queries, and
// column mapping — against the migration SQL that ships to D1. The in-memory
// fakes stay the parity oracle; this suite proves the D1 impl agrees with them
// (mirrors fakes.test.ts).
function d1Shim(sqlite: DatabaseSync): D1Database {
  const normalize = (value: unknown) =>
    typeof value === "boolean" ? (value ? 1 : 0) : value === undefined ? null : value;

  const statement = (sql: string, params: unknown[]): D1PreparedStatement => ({
    bind: (...values) => statement(sql, values),
    first: async <T = Record<string, unknown>>(columnName?: string) => {
      const row = sqlite.prepare(sql).get(...params.map(normalize)) as
        Record<string, unknown> | undefined;
      if (!row) return null;
      return (columnName ? row[columnName] : row) as T;
    },
    run: async (): Promise<D1Result> => {
      const { changes, lastInsertRowid } = sqlite.prepare(sql).run(...params.map(normalize));
      return {
        results: [],
        success: true,
        meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid) },
      };
    },
    all: async <T = Record<string, unknown>>(): Promise<D1Result<T>> => ({
      results: sqlite.prepare(sql).all(...params.map(normalize)) as T[],
      success: true,
      meta: {},
    }),
    raw: async <T = unknown[]>(): Promise<T[]> => {
      const rows = sqlite.prepare(sql).all(...params.map(normalize)) as Record<string, unknown>[];
      return rows.map((row) => Object.values(row)) as T[];
    },
  });

  return {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => Promise.all(statements.map((stmt) => stmt.all())),
    exec: async (sql) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
    dump: () => Promise.reject(new Error("dump is not implemented in the test shim")),
  };
}

function createTestDatabase(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  // D1 enforces foreign keys; mirror that so the shipped schema is checked
  // faithfully (insert order in seedAll is parent-before-child).
  sqlite.exec("pragma foreign_keys = on");
  sqlite.exec(readFileSync(new URL("../../../migrations/0001_init.sql", import.meta.url), "utf8"));
  return d1Shim(sqlite);
}

// The repository interface has no studio/settings insert (provisioning
// concern), so those two seed rows go in as raw SQL; everything else seeds
// through the adapter, doubling as coverage for every insert path.
async function insertRow(
  db: D1Database,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(row);
  const columns = keys.map(toSnakeKey).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  await db
    .prepare(`insert into ${table} (${columns}) values (${placeholders})`)
    .bind(...keys.map((key) => row[key]))
    .run();
}

async function seedAll(db: D1Database, repos: Repositories, seed: SeedData): Promise<void> {
  await insertRow(db, "studios", { ...seed.studio });
  await insertRow(db, "studio_settings", { ...seed.settings });
  for (const member of seed.members) await repos.members.insert(member);
  for (const classType of seed.classTypes) await repos.classTypes.insert(classType);
  for (const session of seed.sessions) await repos.classSessions.insert(session);
  for (const booking of seed.bookings) await repos.bookings.insert(booking);
  for (const invoice of seed.invoices) await repos.invoices.insert(invoice);
  await repos.invoiceLineItems.insertMany(seed.lineItems);
  for (const row of seed.outbox) await repos.outbox.insert(row);
}

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    const db = createTestDatabase();
    repos = createD1Repositories(db);
    const seed = buildSeed(NOW);
    await seedAll(db, repos, seed);
    studioId = seed.studio.id;
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
    expect(await repos.settings.getByStudioId("missing")).toBeNull();
  });

  it("updates settings and reads the booleans back", async () => {
    const updated = await repos.settings.update(studioId, { waitlistEnabled: false });
    expect(updated.waitlistEnabled).toBe(false);
    const refetched = await repos.settings.getByStudioId(studioId);
    expect(refetched?.waitlistEnabled).toBe(false);
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

  it("lists bookings across multiple session ids, short-circuiting on empty", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("inserts then reads back by id (values round-trip exactly)", async () => {
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
    const inserted = await repos.members.insert(member);
    expect(inserted).toEqual(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("updates a member and returns the persisted row", async () => {
    const members = await repos.members.listByStudio(studioId);
    const updated = await repos.members.update(members[0].id, {
      status: "paused",
      notificationsOptedOut: true,
    });
    expect(updated.status).toBe("paused");
    expect(updated.notificationsOptedOut).toBe(true);
    const refetched = await repos.members.getById(members[0].id);
    expect(refetched?.status).toBe("paused");
    expect(refetched?.notificationsOptedOut).toBe(true);
  });

  it("lists invoices newest-first and counts them for the studio", async () => {
    const list = await repos.invoices.listByStudio(studioId);
    const issuedAts = list.map((invoice) => invoice.issuedAt);
    expect(issuedAts).toEqual([...issuedAts].sort((a, b) => b.localeCompare(a)));
    expect(await repos.invoices.countByStudio(studioId)).toBe(list.length);
    expect(await repos.invoices.countByStudio("missing")).toBe(0);
  });

  it("lists line items per invoice and short-circuits insertMany on empty", async () => {
    const [invoice] = await repos.invoices.listByStudio(studioId);
    const items = await repos.invoiceLineItems.listByInvoice(invoice.id);
    expect(items.every((item) => item.invoiceId === invoice.id)).toBe(true);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    const updated = await repos.outbox.update(pending[0].id, {
      sentAt: NOW.toISOString(),
      providerMessageId: "re_test0001",
    });
    expect(updated.sentAt).toBe(NOW.toISOString());
    const stillPending = await repos.outbox.listPending();
    expect(stillPending.some((row) => row.id === pending[0].id)).toBe(false);
  });

  it("empty database returns nulls / empty lists", async () => {
    const empty = createD1Repositories(createTestDatabase());
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
    expect(await empty.invoices.countByStudio("x")).toBe(0);
    expect(await empty.outbox.listPending()).toEqual([]);
  });
});
