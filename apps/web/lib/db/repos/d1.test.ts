import { beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;
  let mf: Miniflare;

  beforeEach(async () => {
    // Initialize Miniflare with in-memory D1
    mf = new Miniflare({
      modules: true,
      script: "",
      d1Databases: { DB: ":memory:" },
    });

    // Apply the schema
    const db = await mf.getD1Database("DB");
    const migrations = [getMigrationSQL()];

    for (const migration of migrations) {
      const statements = migration
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("--"));
      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }
    }

    // Seed the database
    const seed = buildSeed(NOW);
    const seedStatements = buildSeedSQL(seed);
    for (const stmt of seedStatements) {
      await db.prepare(stmt).run();
    }

    repos = createD1Repositories(db);
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

  it("update returns an isolated clone (store not mutated by reference)", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    updated.status = "active"; // mutate the returned object
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
});

function getMigrationSQL(): string {
  return `
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
  `;
}

function buildSeedSQL(seed: ReturnType<typeof buildSeed>): string[] {
  const statements: string[] = [];

  // Insert studio
  statements.push(
    `INSERT INTO studios (id, name, slug, timezone, created_at) VALUES ('${seed.studio.id}', '${seed.studio.name}', '${seed.studio.slug}', '${seed.studio.timezone}', '${seed.studio.createdAt}')`,
  );

  // Insert settings
  statements.push(
    `INSERT INTO studio_settings (
      studio_id, currency, tax_rate_bps, cancellation_window_hours,
      waitlist_enabled, notify_booking_confirmations, notify_cancellations,
      notify_waitlist_promotions, notify_invoices
    ) VALUES (
      '${seed.settings.studioId}', '${seed.settings.currency}', ${seed.settings.taxRateBps}, ${seed.settings.cancellationWindowHours},
      ${seed.settings.waitlistEnabled ? 1 : 0}, ${seed.settings.notifyBookingConfirmations ? 1 : 0},
      ${seed.settings.notifyCancellations ? 1 : 0}, ${seed.settings.notifyWaitlistPromotions ? 1 : 0},
      ${seed.settings.notifyInvoices ? 1 : 0}
    )`,
  );

  // Insert members
  seed.members.forEach((member) => {
    statements.push(
      `INSERT INTO members (
        id, studio_id, name, email, phone, status, notifications_opted_out, created_at
      ) VALUES (
        '${member.id}', '${member.studioId}', '${escape(member.name)}', '${member.email}',
        ${member.phone ? `'${member.phone}'` : "NULL"}, '${member.status}',
        ${member.notificationsOptedOut ? 1 : 0}, '${member.createdAt}'
      )`,
    );
  });

  // Insert class types
  seed.classTypes.forEach((ct) => {
    statements.push(
      `INSERT INTO class_types (
        id, studio_id, name, description, color, default_capacity, default_price_cents, created_at
      ) VALUES (
        '${ct.id}', '${ct.studioId}', '${escape(ct.name)}',
        ${ct.description ? `'${escape(ct.description)}'` : "NULL"}, '${ct.color}',
        ${ct.defaultCapacity}, ${ct.defaultPriceCents}, '${ct.createdAt}'
      )`,
    );
  });

  // Insert sessions
  seed.sessions.forEach((session) => {
    statements.push(
      `INSERT INTO class_sessions (
        id, studio_id, class_type_id, instructor, starts_at, ends_at, capacity, price_cents, status, created_at
      ) VALUES (
        '${session.id}', '${session.studioId}', '${session.classTypeId}', '${escape(session.instructor)}',
        '${session.startsAt}', '${session.endsAt}', ${session.capacity}, ${session.priceCents},
        '${session.status}', '${session.createdAt}'
      )`,
    );
  });

  // Insert bookings
  seed.bookings.forEach((booking) => {
    statements.push(
      `INSERT INTO bookings (
        id, session_id, member_id, status, booked_at, cancelled_at
      ) VALUES (
        '${booking.id}', '${booking.sessionId}', '${booking.memberId}', '${booking.status}',
        '${booking.bookedAt}', ${booking.cancelledAt ? `'${booking.cancelledAt}'` : "NULL"}
      )`,
    );
  });

  // Insert invoices
  seed.invoices.forEach((invoice) => {
    statements.push(
      `INSERT INTO invoices (
        id, studio_id, member_id, number, status, currency, tax_rate_bps,
        subtotal_cents, tax_cents, total_cents, issued_at, due_at, paid_at, created_at
      ) VALUES (
        '${invoice.id}', '${invoice.studioId}', '${invoice.memberId}', '${invoice.number}',
        '${invoice.status}', '${invoice.currency}', ${invoice.taxRateBps},
        ${invoice.subtotalCents}, ${invoice.taxCents}, ${invoice.totalCents},
        '${invoice.issuedAt}', ${invoice.dueAt ? `'${invoice.dueAt}'` : "NULL"},
        ${invoice.paidAt ? `'${invoice.paidAt}'` : "NULL"}, '${invoice.createdAt}'
      )`,
    );
  });

  // Insert line items
  seed.lineItems.forEach((item) => {
    statements.push(
      `INSERT INTO invoice_line_items (
        id, invoice_id, description, quantity, unit_amount_cents, amount_cents, refunded, booking_id
      ) VALUES (
        '${item.id}', '${item.invoiceId}', '${escape(item.description)}', ${item.quantity},
        ${item.unitAmountCents}, ${item.amountCents}, ${item.refunded ? 1 : 0},
        ${item.bookingId ? `'${item.bookingId}'` : "NULL"}
      )`,
    );
  });

  // Insert outbox rows
  seed.outbox.forEach((row) => {
    statements.push(
      `INSERT INTO notification_outbox (
        id, member_id, kind, payload, created_at, sent_at, provider_message_id, error
      ) VALUES (
        '${row.id}', '${row.memberId}', '${row.kind}', '${escape(row.payload)}',
        '${row.createdAt}', ${row.sentAt ? `'${row.sentAt}'` : "NULL"},
        ${row.providerMessageId ? `'${row.providerMessageId}'` : "NULL"},
        ${row.error ? `'${escape(row.error)}'` : "NULL"}
      )`,
    );
  });

  return statements;
}

function escape(str: string): string {
  return str.replace(/'/g, "''");
}
