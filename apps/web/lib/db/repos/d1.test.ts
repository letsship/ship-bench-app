import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const MIGRATION_STATEMENTS = [
  "CREATE TABLE studios ( id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'UTC', created_at TEXT NOT NULL )",
  "CREATE TABLE studio_settings ( studio_id TEXT PRIMARY KEY NOT NULL REFERENCES studios(id) ON DELETE CASCADE, currency TEXT NOT NULL DEFAULT 'EUR', tax_rate_bps INTEGER NOT NULL DEFAULT 0, cancellation_window_hours INTEGER NOT NULL DEFAULT 12, waitlist_enabled INTEGER NOT NULL DEFAULT 1, notify_booking_confirmations INTEGER NOT NULL DEFAULT 1, notify_cancellations INTEGER NOT NULL DEFAULT 1, notify_waitlist_promotions INTEGER NOT NULL DEFAULT 1, notify_invoices INTEGER NOT NULL DEFAULT 1 )",
  "CREATE TABLE members ( id TEXT PRIMARY KEY NOT NULL, studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, status TEXT NOT NULL DEFAULT 'active', notifications_opted_out INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE (studio_id, email) )",
  "CREATE INDEX idx_members_studio ON members (studio_id)",
  "CREATE TABLE class_types ( id TEXT PRIMARY KEY NOT NULL, studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, color TEXT NOT NULL DEFAULT '#6b7280', default_capacity INTEGER NOT NULL DEFAULT 12, default_price_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL )",
  "CREATE TABLE class_sessions ( id TEXT PRIMARY KEY NOT NULL, studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE, class_type_id TEXT NOT NULL REFERENCES class_types(id), instructor TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, capacity INTEGER NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT NOT NULL )",
  "CREATE INDEX idx_class_sessions_studio ON class_sessions (studio_id)",
  "CREATE INDEX idx_class_sessions_starts_at ON class_sessions (starts_at)",
  "CREATE TABLE bookings ( id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), status TEXT NOT NULL DEFAULT 'booked', booked_at TEXT NOT NULL, cancelled_at TEXT )",
  "CREATE INDEX idx_bookings_session ON bookings (session_id)",
  "CREATE INDEX idx_bookings_member ON bookings (member_id)",
  "CREATE TABLE invoices ( id TEXT PRIMARY KEY NOT NULL, studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', currency TEXT NOT NULL DEFAULT 'EUR', tax_rate_bps INTEGER NOT NULL DEFAULT 0, subtotal_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL DEFAULT 0, issued_at TEXT NOT NULL, due_at TEXT, paid_at TEXT, created_at TEXT NOT NULL, UNIQUE (studio_id, number) )",
  "CREATE INDEX idx_invoices_member ON invoices (member_id)",
  "CREATE TABLE invoice_line_items ( id TEXT PRIMARY KEY NOT NULL, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_amount_cents INTEGER NOT NULL DEFAULT 0, amount_cents INTEGER NOT NULL DEFAULT 0, refunded INTEGER NOT NULL DEFAULT 0, booking_id TEXT REFERENCES bookings(id) )",
  "CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items (invoice_id)",
  "CREATE TABLE notification_outbox ( id TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT, provider_message_id TEXT, error TEXT )",
  "CREATE INDEX idx_notification_outbox_sent ON notification_outbox (sent_at)",
];

async function createTestDb(): Promise<D1Database> {
  const mf = new Miniflare({
    modules: true,
    script: "",
    d1Databases: { DB: "test" },
  });
  const db = await mf.getD1Database("DB");
  for (const stmt of MIGRATION_STATEMENTS) {
    await db.exec(stmt);
  }
  return db;
}

async function seedDb(db: D1Database, repos: Repositories): Promise<string> {
  const seed = buildSeed(NOW);
  // StudioRepo has no insert method, so use raw D1 SQL
  await db.prepare(
    "INSERT INTO studios (id, name, slug, timezone, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(seed.studio.id, seed.studio.name, seed.studio.slug, seed.studio.timezone, seed.studio.createdAt).run();
  // StudioSettingsRepo has no insert method either
  await db.prepare(
    "INSERT INTO studio_settings (studio_id, currency, tax_rate_bps, cancellation_window_hours, " +
    "waitlist_enabled, notify_booking_confirmations, notify_cancellations, " +
    "notify_waitlist_promotions, notify_invoices) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    seed.settings.studioId, seed.settings.currency, seed.settings.taxRateBps,
    seed.settings.cancellationWindowHours, seed.settings.waitlistEnabled ? 1 : 0,
    seed.settings.notifyBookingConfirmations ? 1 : 0, seed.settings.notifyCancellations ? 1 : 0,
    seed.settings.notifyWaitlistPromotions ? 1 : 0, seed.settings.notifyInvoices ? 1 : 0
  ).run();
  for (const m of seed.members) await repos.members.insert(m);
  for (const ct of seed.classTypes) await repos.classTypes.insert(ct);
  for (const s of seed.sessions) await repos.classSessions.insert(s);
  for (const b of seed.bookings) await repos.bookings.insert(b);
  for (const inv of seed.invoices) await repos.invoices.insert(inv);
  await repos.invoiceLineItems.insertMany(seed.lineItems);
  for (const row of seed.outbox) await repos.outbox.insert(row);
  return seed.studio.id;
}

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    const db = await createTestDb();
    repos = createD1Repositories(db);
    studioId = await seedDb(db, repos);
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((m: { name: string }) => m.name);
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

  it("returns empty list for empty sessionIds", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("inserts then reads back by id", async () => {
    const member = {
      id: "mem_new_d1_test",
      studioId,
      name: "New Person",
      email: "newd1@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new_d1_test")).toEqual(member);
  });

  it("update persists the change", async () => {
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
  });

  it("lists invoices ordered by issuedAt desc", async () => {
    const list = await repos.invoices.listByStudio(studioId);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].issuedAt >= list[i].issuedAt).toBe(true);
    }
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("insertMany returns line items", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    if (invoices.length === 0) return;
    const invoiceId = invoices[0].id;
    const items = await repos.invoiceLineItems.listByInvoice(invoiceId);
    expect(items.length).toBeGreaterThan(0);
  });
});