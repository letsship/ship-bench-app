import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Schema/DDL parity smoke test: applies the generated D1 migration to an
// in-memory better-sqlite3 database, then exercises `createD1Repositories`'
// CRUD paths through a minimal D1Database-shaped shim over that connection.
// This checks the Drizzle schema <-> migration <-> repository wiring
// end-to-end without needing a live D1 binding or Miniflare.

const MIGRATION_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../packages/db/migrations/d1/0001_init.sql",
);

// A D1Database is just `.prepare(sql).bind(...params)` + `.run()/.all()/.raw()`
// as far as drizzle-orm's D1 driver is concerned (see drizzle-orm/d1/session.js).
// This shim implements exactly that subset over a better-sqlite3 connection.
function d1FromSqlite(sqlite: Database.Database): D1Database {
  function prepare(query: string) {
    let params: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        params = values;
        return this;
      },
      async run() {
        const info = sqlite.prepare(query).run(...(params as never[]));
        return {
          success: true,
          results: [],
          meta: {
            duration: 0,
            rows_read: 0,
            rows_written: info.changes,
            last_row_id: Number(info.lastInsertRowid),
            changed_db: info.changes > 0,
            changes: info.changes,
          },
        };
      },
      async all() {
        const results = sqlite.prepare(query).all(...(params as never[]));
        return { success: true, results, meta: { duration: 0 } };
      },
      async raw() {
        return sqlite
          .prepare(query)
          .raw(true)
          .all(...(params as never[]));
      },
      async first() {
        throw new Error("not implemented in test shim");
      },
    };
  }

  return {
    prepare,
    async batch(statements: { run: () => unknown }[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
    async exec() {
      throw new Error("not implemented in test shim");
    },
    withSession() {
      throw new Error("not implemented in test shim");
    },
    async dump() {
      throw new Error("not implemented in test shim");
    },
  } as unknown as D1Database;
}

const STUDIO_ID = "studio_1";

// Studios and studio_settings have no `insert` on the repository interface
// (services never create a studio at runtime) — seeding, like the real
// deployment's migration + seed data, happens with raw SQL.
function seedStudio(sqlite: Database.Database): void {
  sqlite
    .prepare("INSERT INTO studios (id, name, slug, timezone, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(
      STUDIO_ID,
      "Riverbank Movement",
      "riverbank",
      "Europe/Amsterdam",
      "2026-01-01T00:00:00.000Z",
    );
  sqlite
    .prepare(
      `INSERT INTO studio_settings (
        studio_id, currency, tax_rate_bps, cancellation_window_hours, waitlist_enabled,
        notify_booking_confirmations, notify_cancellations, notify_waitlist_promotions, notify_invoices
      ) VALUES (?, 'EUR', 0, 12, 1, 1, 1, 1, 1)`,
    )
    .run(STUDIO_ID);
}

describe("D1 repositories (schema/DDL parity)", () => {
  let repos: Repositories;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.exec(readFileSync(MIGRATION_PATH, "utf8"));
    seedStudio(sqlite);
    repos = createD1Repositories(d1FromSqlite(sqlite));
  });

  it("reads back the seeded studio", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio).toEqual({
      id: STUDIO_ID,
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("reads and updates studio settings, boolean mapping included", async () => {
    const settings = await repos.settings.getByStudioId(STUDIO_ID);
    expect(settings).toEqual({
      studioId: STUDIO_ID,
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    });

    const updated = await repos.settings.update(STUDIO_ID, { waitlistEnabled: false });
    expect(updated.waitlistEnabled).toBe(false);
    expect(await repos.settings.getByStudioId(STUDIO_ID)).toEqual(updated);
  });

  it("round-trips a member insert, boolean mapping included", async () => {
    const member = await repos.members.insert({
      id: "mem_1",
      studioId: STUDIO_ID,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    expect(member.notificationsOptedOut).toBe(false);

    const fetched = await repos.members.getById("mem_1");
    expect(fetched).toEqual(member);

    const found = await repos.members.findByEmail(STUDIO_ID, "amara@example.com");
    expect(found?.id).toBe("mem_1");

    const updated = await repos.members.update("mem_1", { notificationsOptedOut: true });
    expect(updated.notificationsOptedOut).toBe(true);

    const listed = await repos.members.listByStudio(STUDIO_ID);
    expect(listed).toEqual([updated]);
  });

  it("lists bookings across multiple session ids and respects the empty-list shortcut", async () => {
    await repos.classTypes.insert({
      id: "ct_1",
      studioId: STUDIO_ID,
      name: "Vinyasa",
      description: null,
      color: "#6b7280",
      defaultCapacity: 12,
      defaultPriceCents: 1800,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await repos.classSessions.insert({
      id: "cs_1",
      studioId: STUDIO_ID,
      classTypeId: "ct_1",
      instructor: "Amara",
      startsAt: "2026-02-01T09:00:00.000Z",
      endsAt: "2026-02-01T10:00:00.000Z",
      capacity: 12,
      priceCents: 1800,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await repos.members.insert({
      id: "mem_1",
      studioId: STUDIO_ID,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const booking = await repos.bookings.insert({
      id: "bk_1",
      sessionId: "cs_1",
      memberId: "mem_1",
      status: "booked",
      bookedAt: "2026-02-01T08:00:00.000Z",
      cancelledAt: null,
    });

    expect(await repos.bookings.listBySessionIds(["cs_1"])).toEqual([booking]);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("counts and lists invoices for a studio, newest first", async () => {
    await repos.members.insert({
      id: "mem_1",
      studioId: STUDIO_ID,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    await repos.invoices.insert({
      id: "inv_1",
      studioId: STUDIO_ID,
      memberId: "mem_1",
      number: "INV-1",
      status: "draft",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 1000,
      taxCents: 0,
      totalCents: 1000,
      issuedAt: "2026-01-10T00:00:00.000Z",
      dueAt: null,
      paidAt: null,
      createdAt: "2026-01-10T00:00:00.000Z",
    });
    await repos.invoices.insert({
      id: "inv_2",
      studioId: STUDIO_ID,
      memberId: "mem_1",
      number: "INV-2",
      status: "draft",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 2000,
      taxCents: 0,
      totalCents: 2000,
      issuedAt: "2026-01-20T00:00:00.000Z",
      dueAt: null,
      paidAt: null,
      createdAt: "2026-01-20T00:00:00.000Z",
    });

    expect(await repos.invoices.countByStudio(STUDIO_ID)).toBe(2);
    const listed = await repos.invoices.listByStudio(STUDIO_ID);
    expect(listed.map((invoice) => invoice.id)).toEqual(["inv_2", "inv_1"]);

    const lineItems = await repos.invoiceLineItems.insertMany([
      {
        id: "li_1",
        invoiceId: "inv_1",
        description: "Drop-in class",
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: false,
        bookingId: null,
      },
    ]);
    expect(lineItems).toEqual(await repos.invoiceLineItems.listByInvoice("inv_1"));
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("inserts and marks a notification outbox row sent", async () => {
    await repos.members.insert({
      id: "mem_1",
      studioId: STUDIO_ID,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const row = await repos.outbox.insert({
      id: "out_1",
      memberId: "mem_1",
      kind: "booking_confirmation",
      payload: "{}",
      createdAt: "2026-01-10T00:00:00.000Z",
      sentAt: null,
      providerMessageId: null,
      error: null,
    });

    expect(await repos.outbox.listPending()).toEqual([row]);
    const sent = await repos.outbox.update("out_1", {
      sentAt: "2026-01-10T00:01:00.000Z",
      providerMessageId: "msg_1",
    });
    expect(sent.sentAt).toBe("2026-01-10T00:01:00.000Z");
    expect(await repos.outbox.listPending()).toEqual([]);
  });
});
