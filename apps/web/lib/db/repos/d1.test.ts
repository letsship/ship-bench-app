import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import { toSnakeRow } from "./mapping";
import type { Repositories } from "./types";

// Exercises createD1Repositories end-to-end against a real SQLite database:
// apps/web/migrations/0001_init.sql applied via better-sqlite3, wrapped in a
// minimal D1Database-compatible shim covering exactly what drizzle-orm/d1's
// driver calls (prepare(sql).bind(...params).run() / .all() / .raw()). Asserts
// the same repository behaviours covered by fakes.test.ts, so both
// implementations behind the seam stay symmetric.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const MIGRATION_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations/0001_init.sql",
);

function bindValue(value: unknown): unknown {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

function insertRow(sqlite: Database.Database, table: string, row: object): void {
  const snake = toSnakeRow(row as Record<string, unknown>);
  const columns = Object.keys(snake);
  const placeholders = columns.map(() => "?").join(", ");
  sqlite
    .prepare(`insert into ${table} (${columns.join(", ")}) values (${placeholders})`)
    .run(...columns.map((column) => bindValue(snake[column])));
}

function seedDatabase(sqlite: Database.Database): string {
  const seed = buildSeed(NOW);
  insertRow(sqlite, "studios", seed.studio);
  insertRow(sqlite, "studio_settings", seed.settings);
  for (const row of seed.members) insertRow(sqlite, "members", row);
  for (const row of seed.classTypes) insertRow(sqlite, "class_types", row);
  for (const row of seed.sessions) insertRow(sqlite, "class_sessions", row);
  for (const row of seed.bookings) insertRow(sqlite, "bookings", row);
  for (const row of seed.invoices) insertRow(sqlite, "invoices", row);
  for (const row of seed.lineItems) insertRow(sqlite, "invoice_line_items", row);
  for (const row of seed.outbox) insertRow(sqlite, "notification_outbox", row);
  return seed.studio.id;
}

// Minimal D1Database-compatible shim over better-sqlite3. Implements exactly
// the surface drizzle-orm/d1's session calls (see node_modules/drizzle-orm/d1/
// session.js): prepare(sql).bind(...params) then .run() / .all() / .raw().
function toD1Database(sqlite: Database.Database): D1Database {
  function prepare(query: string): D1PreparedStatement {
    let params: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        params = values;
        return statement;
      },
      async first(colName?: string) {
        const row = sqlite.prepare(query).get(...params) as Record<string, unknown> | undefined;
        if (!row) return null;
        return colName ? (row[colName] ?? null) : row;
      },
      async run() {
        const info = sqlite.prepare(query).run(...params);
        return {
          success: true,
          results: [],
          meta: {
            duration: 0,
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid),
            rows_read: 0,
            rows_written: info.changes,
          },
        };
      },
      async all() {
        const results = sqlite.prepare(query).all(...params);
        return { success: true, results, meta: { duration: 0 } };
      },
      async raw(options?: { columnNames?: boolean }) {
        const stmt = sqlite.prepare(query);
        const rows = stmt.raw().all(...params) as unknown[][];
        return options?.columnNames ? [stmt.columns().map((column) => column.name), ...rows] : rows;
      },
    };
    return statement as unknown as D1PreparedStatement;
  }

  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      const results = [];
      for (const statement of statements) {
        results.push(await (statement as unknown as { run(): Promise<unknown> }).run());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    withSession() {
      throw new Error("withSession is not implemented by the test D1 shim");
    },
    async dump() {
      throw new Error("dump is not implemented by the test D1 shim");
    },
  } as unknown as D1Database;
}

describe("D1 repositories (Drizzle over SQLite)", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.exec(readFileSync(MIGRATION_PATH, "utf8"));
    studioId = seedDatabase(sqlite);
    repos = createD1Repositories(toD1Database(sqlite));
  });

  it("returns the seeded studio + settings, with boolean flags round-tripped", async () => {
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

  it("lists bookings across multiple session ids, and returns [] for an empty list", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(bookings.length).toBeGreaterThan(0);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("inserts a member then reads it back by id, with boolean round-tripping", async () => {
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

  it("updates a booking and returns the persisted row", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const allBookings = await repos.bookings.listBySessionIds(sessions.map((s) => s.id));
    const target = allBookings[0];
    const updated = await repos.bookings.update(target.id, {
      status: "cancelled",
      cancelledAt: NOW.toISOString(),
    });
    expect(updated.status).toBe("cancelled");
    expect(await repos.bookings.getById(target.id)).toMatchObject({ status: "cancelled" });
  });

  it("counts invoices for the studio and orders them by issuedAt desc", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
    const issuedDates = list.map((invoice) => invoice.issuedAt);
    expect(issuedDates).toEqual([...issuedDates].sort().reverse());
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("round-trips the refunded line item boolean flag", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const lineItems = (
      await Promise.all(invoices.map((invoice) => repos.invoiceLineItems.listByInvoice(invoice.id)))
    ).flat();
    expect(lineItems.some((item) => item.refunded === true)).toBe(true);
    for (const item of lineItems) expect(typeof item.refunded).toBe("boolean");
  });
});
