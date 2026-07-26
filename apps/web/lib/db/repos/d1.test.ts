import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/d1";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import * as schema from "./schema";
import type { Repositories } from "./types";

// Vitest suite exercising the Drizzle/D1 adapter against an in-memory
// better-sqlite3 database wrapped in a minimal `D1Database`-shaped shim, over
// the same migration SQL wrangler applies in production. Mirrors
// fakes.test.ts so the two implementations are asserted to behave the same
// way against the same seed.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const MIGRATION_SQL = readFileSync(join(__dirname, "../../../migrations/0001_init.sql"), "utf-8");

interface ShimStatement {
  bind: (...params: unknown[]) => ShimStatement;
  all: () => Promise<{ results: unknown[]; success: true; meta: Record<string, never> }>;
  run: () => Promise<{
    success: true;
    meta: { changes: number; last_row_id: number };
    results: never[];
  }>;
  raw: () => Promise<unknown[][]>;
}

function wrapStatement(stmt: Database.Statement, params: unknown[]): ShimStatement {
  return {
    bind: (...boundParams) => wrapStatement(stmt, boundParams),
    all: async () => ({ results: stmt.all(...params), success: true, meta: {} }),
    run: async () => {
      const info = stmt.run(...params);
      return {
        success: true,
        meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
        results: [],
      };
    },
    raw: async () => stmt.raw(true).all(...params) as unknown[][],
  };
}

// Minimal D1Database shim over better-sqlite3 covering the subset
// drizzle-orm/d1 actually calls: prepare().bind().all()/.run()/.raw().
function createD1Shim(sqliteDb: Database.Database): D1Database {
  return {
    prepare: (sql: string) => wrapStatement(sqliteDb.prepare(sql), []),
  } as unknown as D1Database;
}

function createSeededRepos(): Repositories {
  const sqliteDb = new Database(":memory:");
  sqliteDb.exec(MIGRATION_SQL);
  const shim = createD1Shim(sqliteDb);
  const seedDb = drizzle(shim, { schema });

  const seed = buildSeed(NOW);
  seedDb.insert(schema.studios).values(seed.studio).run();
  seedDb.insert(schema.studioSettings).values(seed.settings).run();
  for (const member of seed.members) seedDb.insert(schema.members).values(member).run();
  for (const classType of seed.classTypes) seedDb.insert(schema.classTypes).values(classType).run();
  for (const session of seed.sessions) seedDb.insert(schema.classSessions).values(session).run();
  for (const booking of seed.bookings) seedDb.insert(schema.bookings).values(booking).run();
  for (const invoice of seed.invoices) seedDb.insert(schema.invoices).values(invoice).run();
  for (const item of seed.lineItems) seedDb.insert(schema.invoiceLineItems).values(item).run();
  for (const row of seed.outbox) seedDb.insert(schema.notificationOutbox).values(row).run();

  return createD1Repositories(shim);
}

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createSeededRepos();
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
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
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
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

  it("update returns the patched row", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
    expect(count).toBeGreaterThan(0);
  });

  it("lists invoices ordered by issuedAt desc", async () => {
    const list = await repos.invoices.listByStudio(studioId);
    const issuedDates = list.map((invoice) => invoice.issuedAt);
    expect(issuedDates).toEqual([...issuedDates].sort((a, b) => b.localeCompare(a)));
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });
});
