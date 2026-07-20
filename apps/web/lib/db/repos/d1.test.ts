import { beforeEach, describe, expect, it } from "vitest";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// better-sqlite3 requires native compilation, which may not be available in all CI environments.
// These tests are designed to run locally with the native module built, but skip gracefully in CI.
let Database: typeof import("better-sqlite3").default | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("better-sqlite3");
  // Test that the module actually works by trying to create an in-memory database
  // This will throw if the native bindings are missing
  const testDb = mod(":memory:");
  testDb.close();
  Database = mod;
} catch {
  // better-sqlite3 native module not available or broken; tests will be skipped
  Database = null;
}

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Minimal D1Database shim wrapping better-sqlite3 for testing
class TestD1Database implements D1Database {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  prepare(sql: string): D1Database.PreparedStatement {
    const stmt = this.db.prepare(sql);

    class TestPreparedStatement {
      private bindParams: unknown[] = [];

      bind(...values: unknown[]) {
        this.bindParams = values;
        return this;
      }

      async first<T = unknown>(values?: unknown | unknown[]): Promise<T | null> {
        const params =
          this.bindParams.length > 0
            ? this.bindParams
            : Array.isArray(values)
              ? values
              : values
                ? [values]
                : [];
        return (stmt.get(...params) as T) || null;
      }

      async all<T = unknown>(values?: unknown | unknown[]): Promise<T[]> {
        const params =
          this.bindParams.length > 0
            ? this.bindParams
            : Array.isArray(values)
              ? values
              : values
                ? [values]
                : [];
        return (stmt.all(...params) as T[]) || [];
      }

      async run(values?: unknown | unknown[]): Promise<D1Result> {
        const params =
          this.bindParams.length > 0
            ? this.bindParams
            : Array.isArray(values)
              ? values
              : values
                ? [values]
                : [];
        const info = stmt.run(...params);
        return {
          success: true,
          meta: {
            duration: 0,
            last_row_id: info.lastInsertRowid as number,
            changes: info.changes,
            served_by: "test",
            internal_stats: "",
          },
        };
      }

      async raw(values?: unknown | unknown[]): Promise<unknown[]> {
        const params =
          this.bindParams.length > 0
            ? this.bindParams
            : Array.isArray(values)
              ? values
              : values
                ? [values]
                : [];
        const rows = stmt.all(...params);
        if (!Array.isArray(rows)) return [];
        if (rows.length === 0) return [];
        const firstRow = rows[0] as Record<string, unknown>;
        if (typeof firstRow === "object" && firstRow !== null) {
          const keys = Object.keys(firstRow);
          return rows.map((row) => keys.map((k) => (row as Record<string, unknown>)[k]));
        }
        return rows as unknown[];
      }
    }

    return new TestPreparedStatement() as unknown as D1Database.PreparedStatement;
  }

  async exec(sql: string): Promise<D1Result> {
    this.db.exec(sql);
    return {
      success: true,
      meta: {
        duration: 0,
        last_row_id: 0,
        changes: 0,
        served_by: "test",
        internal_stats: "",
      },
    };
  }

  batch(_statements: D1Database.PreparedStatement[]): Promise<D1Result[]> {
    throw new Error("batch not implemented");
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error("dump not implemented");
  }
}

// Apply migration SQL to create the schema
function createTestSchema(db: Database.Database): void {
  db.exec(`
-- Studiobook initial schema (SQLite / Cloudflare D1).
-- Primary keys are text (ids set app-side); timestamps are text (ISO-8601 UTC).
-- Booleans are stored as integer (0/1); foreign keys and indexes are preserved.

-- =============================================================
-- STUDIOS
-- =============================================================
CREATE TABLE studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL
);

CREATE TABLE studio_settings (
  studio_id TEXT PRIMARY KEY REFERENCES studios(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0),
  cancellation_window_hours INTEGER NOT NULL DEFAULT 12 CHECK (cancellation_window_hours >= 0),
  waitlist_enabled INTEGER NOT NULL DEFAULT 1,
  notify_booking_confirmations INTEGER NOT NULL DEFAULT 1,
  notify_cancellations INTEGER NOT NULL DEFAULT 1,
  notify_waitlist_promotions INTEGER NOT NULL DEFAULT 1,
  notify_invoices INTEGER NOT NULL DEFAULT 1
);

-- =============================================================
-- MEMBERS
-- =============================================================
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notifications_opted_out INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (studio_id, email)
);

CREATE INDEX idx_members_studio ON members (studio_id);

-- =============================================================
-- CLASS TYPES + SESSIONS
-- =============================================================
CREATE TABLE class_types (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6b7280',
  default_capacity INTEGER NOT NULL DEFAULT 12 CHECK (default_capacity >= 1),
  default_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_price_cents >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE class_sessions (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  class_type_id TEXT NOT NULL REFERENCES class_types(id),
  instructor TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_class_sessions_studio ON class_sessions (studio_id);
CREATE INDEX idx_class_sessions_starts_at ON class_sessions (starts_at);

-- =============================================================
-- BOOKINGS
-- =============================================================
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'booked',
  booked_at TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE INDEX idx_bookings_session ON bookings (session_id);
CREATE INDEX idx_bookings_member ON bookings (member_id);

-- =============================================================
-- INVOICES + LINE ITEMS
-- =============================================================
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'EUR',
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL,
  due_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (studio_id, number)
);

CREATE INDEX idx_invoices_member ON invoices (member_id);

CREATE TABLE invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_amount_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  refunded INTEGER NOT NULL DEFAULT 0,
  booking_id TEXT REFERENCES bookings(id)
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);

-- =============================================================
-- NOTIFICATION OUTBOX
-- =============================================================
CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  provider_message_id TEXT,
  error TEXT
);

CREATE INDEX idx_notification_outbox_sent ON notification_outbox (sent_at);
  `);
}

// Seed the database from buildSeed() data
function seedDatabase(db: Database.Database, seed: ReturnType<typeof buildSeed>): void {
  // Insert studio
  const studioStmt = db.prepare(
    "INSERT INTO studios (id, name, slug, timezone, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  studioStmt.run(
    seed.studio.id,
    seed.studio.name,
    seed.studio.slug,
    seed.studio.timezone,
    seed.studio.createdAt,
  );

  // Insert settings
  const settingsStmt = db.prepare(
    `INSERT INTO studio_settings (studio_id, currency, tax_rate_bps, cancellation_window_hours,
      waitlist_enabled, notify_booking_confirmations, notify_cancellations,
      notify_waitlist_promotions, notify_invoices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  settingsStmt.run(
    seed.settings.studioId,
    seed.settings.currency,
    seed.settings.taxRateBps,
    seed.settings.cancellationWindowHours,
    seed.settings.waitlistEnabled ? 1 : 0,
    seed.settings.notifyBookingConfirmations ? 1 : 0,
    seed.settings.notifyCancellations ? 1 : 0,
    seed.settings.notifyWaitlistPromotions ? 1 : 0,
    seed.settings.notifyInvoices ? 1 : 0,
  );

  // Insert members
  const memberStmt = db.prepare(
    `INSERT INTO members (id, studio_id, name, email, phone, status, notifications_opted_out, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const member of seed.members) {
    memberStmt.run(
      member.id,
      member.studioId,
      member.name,
      member.email,
      member.phone,
      member.status,
      member.notificationsOptedOut ? 1 : 0,
      member.createdAt,
    );
  }

  // Insert class types
  const typeStmt = db.prepare(
    `INSERT INTO class_types (id, studio_id, name, description, color, default_capacity, default_price_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const classType of seed.classTypes) {
    typeStmt.run(
      classType.id,
      classType.studioId,
      classType.name,
      classType.description,
      classType.color,
      classType.defaultCapacity,
      classType.defaultPriceCents,
      classType.createdAt,
    );
  }

  // Insert sessions
  const sessionStmt = db.prepare(
    `INSERT INTO class_sessions (id, studio_id, class_type_id, instructor, starts_at, ends_at, capacity, price_cents, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const session of seed.sessions) {
    sessionStmt.run(
      session.id,
      session.studioId,
      session.classTypeId,
      session.instructor,
      session.startsAt,
      session.endsAt,
      session.capacity,
      session.priceCents,
      session.status,
      session.createdAt,
    );
  }

  // Insert bookings
  const bookingStmt = db.prepare(
    `INSERT INTO bookings (id, session_id, member_id, status, booked_at, cancelled_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const booking of seed.bookings) {
    bookingStmt.run(
      booking.id,
      booking.sessionId,
      booking.memberId,
      booking.status,
      booking.bookedAt,
      booking.cancelledAt,
    );
  }

  // Insert invoices
  const invoiceStmt = db.prepare(
    `INSERT INTO invoices (id, studio_id, member_id, number, status, currency, tax_rate_bps,
      subtotal_cents, tax_cents, total_cents, issued_at, due_at, paid_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const invoice of seed.invoices) {
    invoiceStmt.run(
      invoice.id,
      invoice.studioId,
      invoice.memberId,
      invoice.number,
      invoice.status,
      invoice.currency,
      invoice.taxRateBps,
      invoice.subtotalCents,
      invoice.taxCents,
      invoice.totalCents,
      invoice.issuedAt,
      invoice.dueAt,
      invoice.paidAt,
      invoice.createdAt,
    );
  }

  // Insert invoice line items
  const lineItemStmt = db.prepare(
    `INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_amount_cents, amount_cents, refunded, booking_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const lineItem of seed.lineItems) {
    lineItemStmt.run(
      lineItem.id,
      lineItem.invoiceId,
      lineItem.description,
      lineItem.quantity,
      lineItem.unitAmountCents,
      lineItem.amountCents,
      lineItem.refunded ? 1 : 0,
      lineItem.bookingId,
    );
  }

  // Insert outbox rows
  const outboxStmt = db.prepare(
    `INSERT INTO notification_outbox (id, member_id, kind, payload, created_at, sent_at, provider_message_id, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of seed.outbox) {
    outboxStmt.run(
      row.id,
      row.memberId,
      row.kind,
      row.payload,
      row.createdAt,
      row.sentAt,
      row.providerMessageId,
      row.error,
    );
  }
}

describe("D1 repositories", () => {
  // Skip the entire suite if better-sqlite3 is not available (expected in CI without native build)
  if (!Database) {
    it.skip("skipped: better-sqlite3 not available", () => {});
    return;
  }

  let repos: Repositories;
  let studioId: string;

  beforeEach(() => {
    const sqliteDb = new Database(":memory:");
    createTestSchema(sqliteDb);
    const seed = buildSeed(NOW);
    seedDatabase(sqliteDb, seed);

    const d1 = new TestD1Database(sqliteDb);
    repos = createD1Repositories(d1);
    studioId = seed.studio.id;
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((m) => m.name);
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

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("inserts and updates bookings", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const members = await repos.members.listByStudio(studioId);
    expect(sessions.length).toBeGreaterThan(0);
    expect(members.length).toBeGreaterThan(0);

    const booking = await repos.bookings.insert({
      id: "book_new",
      sessionId: sessions[0].id,
      memberId: members[0].id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    expect(booking.id).toBe("book_new");

    const updated = await repos.bookings.update("book_new", { status: "cancelled" });
    expect(updated.status).toBe("cancelled");
  });

  it("listBySessionIds([]) returns empty array", async () => {
    const bookings = await repos.bookings.listBySessionIds([]);
    expect(bookings).toEqual([]);
  });

  it("insertMany([]) returns empty array", async () => {
    const result = await repos.invoiceLineItems.insertMany([]);
    expect(result).toEqual([]);
  });
});
