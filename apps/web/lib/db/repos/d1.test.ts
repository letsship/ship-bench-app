import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";
import type { SeedData } from "./fakes";
import fs from "node:fs";
import path from "node:path";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Minimal D1Database shim backed by Node's built-in DatabaseSync.
//
// The Drizzle D1 driver expects D1PreparedStatement to expose:
//   .bind(...).all()   -> D1Result     (.results = array of row objects)
//   .bind(...).first() -> row | null   (first result object)
//   .bind(...).run()   -> D1Result     (for INSERT/UPDATE/DELETE)
//   .bind(...).raw()   -> unknown[][]   (array of arrays — column-order)
//
// We query PRAGMA table_info to preserve column order for raw().
// ---------------------------------------------------------------------------

class D1Shim implements D1Database {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  prepare(sql: string): D1PreparedStatement {
    return new D1StmtShim(this.db, sql);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return Promise.all(
      statements.map((s) => (s as D1StmtShim).run()),
    );
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error("Not implemented in test shim");
  }
  async raw(): Promise<unknown[]> {
    throw new Error("Not implemented in test shim");
  }
}

class D1StmtShim implements D1PreparedStatement {
  private db: DatabaseSync;
  private sql: string;
  private params: unknown[] = [];

  constructor(db: DatabaseSync, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  bind(...params: unknown[]): D1PreparedStatement {
    this.params = params;
    return this;
  }

  async all(): Promise<D1Result> {
    try {
      const stmt = this.db.prepare(this.sql);
      const rows = stmt.all(...this.params) as Record<string, unknown>[];
      return { results: rows ?? [], success: true };
    } catch (e: any) {
      return { results: [], success: false, error: e?.message ?? String(e) };
    }
  }

  async first(): Promise<Record<string, unknown> | null> {
    const result = await this.all();
    return result.results[0] ?? null;
  }

  async run(): Promise<D1Result> {
    try {
      const stmt = this.db.prepare(this.sql);
      stmt.run(...this.params);
      return { success: true, meta: { changes: 1, last_row_id: 0 } } as D1Result;
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) };
    }
  }

  async raw(): Promise<unknown[][]> {
    // Drizzle's D1 driver calls .raw() for SELECT queries via the
    // D1PreparedQuery.values() path. It expects unknown[][] — column-order
    // arrays. We parse column info from the SQL to preserve order.
    try {
      const stmt = this.db.prepare(this.sql);
      const rows = stmt.all(...this.params) as Record<string, unknown>[];
      if (rows.length === 0) return [];

      // Use column names in insertion order (from the first row's keys).
      const cols = Object.keys(rows[0]);
      return rows.map((row) => cols.map((c) => row[c]));
    } catch (e: any) {
      throw new Error(`raw() failed: ${e?.message ?? String(e)}`);
    }
  }
}

function createTestD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const migrationPath = path.resolve(
    import.meta.dirname ?? __dirname,
    "../../../migrations/0001_init.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  db.exec(migrationSql);
  return new D1Shim(db);
}

function seed(d1: D1Database, data: SeedData): void {
  const inner = (d1 as unknown as { db: DatabaseSync }).db;
  const insertStudio = inner.prepare(
    "INSERT INTO studios (id, name, slug, timezone, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertStudio.run(
    data.studio.id, data.studio.name, data.studio.slug,
    data.studio.timezone, data.studio.createdAt,
  );

  const insertSettings = inner.prepare(
    `INSERT INTO studio_settings
     (studio_id, currency, tax_rate_bps, cancellation_window_hours,
      waitlist_enabled, notify_booking_confirmations, notify_cancellations,
      notify_waitlist_promotions, notify_invoices)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertSettings.run(
    data.settings.studioId, data.settings.currency, data.settings.taxRateBps,
    data.settings.cancellationWindowHours,
    data.settings.waitlistEnabled ? 1 : 0,
    data.settings.notifyBookingConfirmations ? 1 : 0,
    data.settings.notifyCancellations ? 1 : 0,
    data.settings.notifyWaitlistPromotions ? 1 : 0,
    data.settings.notifyInvoices ? 1 : 0,
  );

  const insertMember = inner.prepare(
    "INSERT INTO members (id, studio_id, name, email, phone, status, notifications_opted_out, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const m of data.members) {
    insertMember.run(
      m.id, m.studioId, m.name, m.email, m.phone, m.status,
      m.notificationsOptedOut ? 1 : 0, m.createdAt,
    );
  }

  const insertClassType = inner.prepare(
    "INSERT INTO class_types (id, studio_id, name, description, color, default_capacity, default_price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const ct of data.classTypes) {
    insertClassType.run(
      ct.id, ct.studioId, ct.name, ct.description, ct.color,
      ct.defaultCapacity, ct.defaultPriceCents, ct.createdAt,
    );
  }

  const insertSession = inner.prepare(
    "INSERT INTO class_sessions (id, studio_id, class_type_id, instructor, starts_at, ends_at, capacity, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const s of data.sessions) {
    insertSession.run(
      s.id, s.studioId, s.classTypeId, s.instructor, s.startsAt,
      s.endsAt, s.capacity, s.priceCents, s.status, s.createdAt,
    );
  }

  const insertBooking = inner.prepare(
    "INSERT INTO bookings (id, session_id, member_id, status, booked_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const b of data.bookings) {
    insertBooking.run(
      b.id, b.sessionId, b.memberId, b.status, b.bookedAt, b.cancelledAt,
    );
  }

  const insertInvoice = inner.prepare(
    "INSERT INTO invoices (id, studio_id, member_id, number, status, currency, tax_rate_bps, subtotal_cents, tax_cents, total_cents, issued_at, due_at, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const inv of data.invoices) {
    insertInvoice.run(
      inv.id, inv.studioId, inv.memberId, inv.number, inv.status,
      inv.currency, inv.taxRateBps, inv.subtotalCents, inv.taxCents,
      inv.totalCents, inv.issuedAt, inv.dueAt, inv.paidAt, inv.createdAt,
    );
  }

  const insertLineItem = inner.prepare(
    "INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_amount_cents, amount_cents, refunded, booking_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const li of data.lineItems) {
    insertLineItem.run(
      li.id, li.invoiceId, li.description, li.quantity,
      li.unitAmountCents, li.amountCents, li.refunded ? 1 : 0, li.bookingId,
    );
  }

  const insertOutbox = inner.prepare(
    "INSERT INTO notification_outbox (id, member_id, kind, payload, created_at, sent_at, provider_message_id, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const o of data.outbox) {
    insertOutbox.run(
      o.id, o.memberId, o.kind, o.payload, o.createdAt,
      o.sentAt, o.providerMessageId, o.error,
    );
  }
}

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    const d1 = createTestD1();
    const seedData = buildSeed(NOW);
    seed(d1, seedData);
    repos = createD1Repositories(d1);
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
      id: "mem_new_d1",
      studioId,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new_d1")).toEqual(member);
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

  it("empty D1 returns nulls / empty lists", async () => {
    const emptyD1 = createTestD1();
    const empty = createD1Repositories(emptyD1);
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
  });
});