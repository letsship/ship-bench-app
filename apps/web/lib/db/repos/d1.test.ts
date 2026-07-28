import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Integration test for the Drizzle-over-D1 adapter. A real Worker isn't
// available under Vitest, so we run the adapter against an in-memory SQLite
// database (schema applied from migrations/0001_init.sql) wrapped in a minimal
// D1Database shim over better-sqlite3, and assert the same behaviour the
// in-memory fakes guarantee.

type BindParams = unknown[];

class ShimPreparedStatement {
  constructor(
    private readonly db: Database.Database,
    private readonly query: string,
    private readonly params: BindParams = [],
  ) {}

  bind(...values: BindParams): ShimPreparedStatement {
    return new ShimPreparedStatement(this.db, this.query, values);
  }

  async run(): Promise<{ success: boolean; meta: Record<string, unknown> }> {
    const info = this.db.prepare(this.query).run(...this.params);
    return { success: true, meta: { changes: info.changes } };
  }

  async all(): Promise<{ results: unknown[]; success: boolean }> {
    return { results: this.db.prepare(this.query).all(...this.params), success: true };
  }

  async first(): Promise<unknown> {
    return this.db.prepare(this.query).get(...this.params) ?? null;
  }

  async raw(): Promise<unknown[][]> {
    return this.db.prepare(this.query).raw().all(...this.params) as unknown[][];
  }
}

function createD1Shim(): D1Database {
  const db = new Database(":memory:");
  const migration = readFileSync(new URL("../../../migrations/0001_init.sql", import.meta.url), "utf8");
  db.exec(migration);
  return {
    prepare: (query: string) => new ShimPreparedStatement(db, query),
    batch: async (statements: ShimPreparedStatement[]) =>
      Promise.all(statements.map((statement) => statement.all())),
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("d1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    const d1 = createD1Shim();
    const seed = buildSeed(NOW);
    const client = drizzle(d1, { schema });
    await client.insert(schema.studios).values(seed.studio);
    await client.insert(schema.studioSettings).values(seed.settings);
    await client.insert(schema.members).values(seed.members);
    await client.insert(schema.classTypes).values(seed.classTypes);
    await client.insert(schema.classSessions).values(seed.sessions);
    await client.insert(schema.bookings).values(seed.bookings);
    await client.insert(schema.invoices).values(seed.invoices);
    await client.insert(schema.invoiceLineItems).values(seed.lineItems);
    await client.insert(schema.notificationOutbox).values(seed.outbox);

    repos = createD1Repositories(d1);
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

  it("update returns the full persisted row", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    expect(updated.email).toBe(target.email);
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("lists invoices ordered by issued_at descending", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const issued = invoices.map((invoice) => invoice.issuedAt);
    expect(issued).toEqual([...issued].sort((a, b) => b.localeCompare(a)));
  });

  it("inserts line items in bulk and reads them back", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const items = await repos.invoiceLineItems.listByInvoice(invoices[0].id);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.invoiceId === invoices[0].id)).toBe(true);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("empty tables return nulls / empty lists", async () => {
    const empty = createD1Repositories(createD1Shim());
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
  });
});
