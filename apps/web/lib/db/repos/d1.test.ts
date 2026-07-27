import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Contract test for the D1 adapter. Runs against a REAL local D1 binding
// (miniflare, in-memory — `persist: false`) via `getPlatformProxy()`, so this
// exercises the actual Drizzle-over-D1 SQL rather than a mock. It applies the
// same migration D1 would run in production, then asserts the same round-trip
// behaviour the fakes contract test (`fakes.test.ts`) covers, so the two
// implementations stay behaviourally symmetric.
//
// Fallback: if `getPlatformProxy` ever proves impractical in this suite (e.g.
// no workerd binary available in the CI sandbox), narrow this file to a
// schema/type-shape check and rely on `fakes.test.ts` for the behavioural
// contract — do not disable or skip it.

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Deletion order respects the foreign keys declared in 0001_init.sql.
const TABLES_IN_DELETE_ORDER = [
  "notification_outbox",
  "invoice_line_items",
  "invoices",
  "bookings",
  "class_sessions",
  "class_types",
  "members",
  "studio_settings",
  "studios",
];

function migrationStatements(): string[] {
  const sql = readFileSync(resolve(__dirname, "../../../migrations/0001_init.sql"), "utf8");
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("D1 repositories (drizzle over a local D1 binding)", () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath: resolve(__dirname, "../../../wrangler.jsonc"),
      persist: false,
    });
    db = proxy.env.DB;
    dispose = proxy.dispose;
    await db.batch(migrationStatements().map((statement) => db.prepare(statement)));
  }, 30_000);

  afterAll(async () => {
    await dispose();
  });

  beforeEach(async () => {
    await db.batch(TABLES_IN_DELETE_ORDER.map((table) => db.prepare(`delete from ${table}`)));

    const seed = buildSeed(NOW);
    studioId = seed.studio.id;

    // `studios`/`studio_settings` have no insert method on the Repositories
    // seam (the app never creates a second studio) — seed them directly,
    // exactly like production D1 seeding would.
    await db
      .prepare("insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)")
      .bind(
        seed.studio.id,
        seed.studio.name,
        seed.studio.slug,
        seed.studio.timezone,
        seed.studio.createdAt,
      )
      .run();
    await db
      .prepare(
        `insert into studio_settings
           (studio_id, currency, tax_rate_bps, cancellation_window_hours, waitlist_enabled,
            notify_booking_confirmations, notify_cancellations, notify_waitlist_promotions, notify_invoices)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        seed.settings.studioId,
        seed.settings.currency,
        seed.settings.taxRateBps,
        seed.settings.cancellationWindowHours,
        Number(seed.settings.waitlistEnabled),
        Number(seed.settings.notifyBookingConfirmations),
        Number(seed.settings.notifyCancellations),
        Number(seed.settings.notifyWaitlistPromotions),
        Number(seed.settings.notifyInvoices),
      )
      .run();

    repos = createD1Repositories(db);
    for (const member of seed.members) await repos.members.insert(member);
    for (const classType of seed.classTypes) await repos.classTypes.insert(classType);
    for (const session of seed.sessions) await repos.classSessions.insert(session);
    for (const booking of seed.bookings) await repos.bookings.insert(booking);
    for (const invoice of seed.invoices) await repos.invoices.insert(invoice);
    await repos.invoiceLineItems.insertMany(seed.lineItems);
    for (const row of seed.outbox) await repos.outbox.insert(row);
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

  it("preserves null fields on round trip", async () => {
    const found = await repos.members.findByEmail(studioId, "chiara@example.com");
    expect(found?.phone).toBeNull();
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids, and short-circuits on empty input", async () => {
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

  it("update returns the current row reflecting the patch", async () => {
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

  it("lists invoices most-recent-first", async () => {
    const list = await repos.invoices.listByStudio(studioId);
    const issuedDates = list.map((invoice) => invoice.issuedAt);
    expect(issuedDates).toEqual([...issuedDates].sort().reverse());
  });

  it("insertMany short-circuits on an empty array", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });
});
