import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Integration test for the production D1/Drizzle repository implementation.
// Boots a real local D1 binding via wrangler's `getPlatformProxy()` (Miniflare),
// applies the same migration SQL the production database runs, and exercises
// every repo method — checking parity with the in-memory fakes' behaviour.
//
// `unstable_splitSqlQuery` is a real, typed export present since wrangler
// 4.67.0 (the floor of this repo's `^4.67.0` range) — it's what wrangler's own
// `d1 execute`/`d1 migrations apply` commands use internally to feed
// `D1Database#batch()`. `D1Database#exec()` is not a substitute here: it
// rejects SQL comments and requires one statement per line, so it fails
// directly on this repo's (commented, pretty-printed) migration file.

const here = dirname(fileURLToPath(import.meta.url));
const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("D1 repositories", () => {
  let dispose: () => Promise<void>;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath: resolve(here, "../../../wrangler.jsonc"),
      persist: false,
    });
    dispose = proxy.dispose;

    const migrationPath = resolve(here, "../../../../../packages/db/migrations/0001_init.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");
    const statements = unstable_splitSqlQuery(migrationSql);
    await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));

    repos = createD1Repositories(proxy.env.DB);

    // Studios/settings have no insert method on the repository interface (the
    // seed studio is provisioned once, out of band) — insert directly via D1.
    const seed = buildSeed(NOW);
    studioId = seed.studio.id;
    await proxy.env.DB.prepare(
      "insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)",
    )
      .bind(
        seed.studio.id,
        seed.studio.name,
        seed.studio.slug,
        seed.studio.timezone,
        seed.studio.createdAt,
      )
      .run();
    await proxy.env.DB.prepare(
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
        seed.settings.waitlistEnabled ? 1 : 0,
        seed.settings.notifyBookingConfirmations ? 1 : 0,
        seed.settings.notifyCancellations ? 1 : 0,
        seed.settings.notifyWaitlistPromotions ? 1 : 0,
        seed.settings.notifyInvoices ? 1 : 0,
      )
      .run();
  }, 30_000);

  afterAll(async () => {
    await dispose?.();
  });

  it("studios.getFirst returns the seeded studio", async () => {
    expect(await repos.studios.getFirst()).toEqual(expect.objectContaining({ id: studioId }));
  });

  it("settings: getByStudioId returns the seeded row, null for an unknown studio, update patches it", async () => {
    expect(await repos.settings.getByStudioId("missing-studio")).toBeNull();
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");

    const updated = await repos.settings.update(studioId, { currency: "USD" });
    expect(updated.currency).toBe("USD");
    expect((await repos.settings.getByStudioId(studioId))?.currency).toBe("USD");
  });

  it("members: insert, list sorted by name, getById, findByEmail, update", async () => {
    const alice = {
      id: "mem_alice",
      studioId,
      name: "Zed Alice",
      email: "alice@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    const bob = {
      id: "mem_bob",
      studioId,
      name: "Anna Bob",
      email: "bob@example.com",
      phone: "+1-555-0100",
      status: "active",
      notificationsOptedOut: true,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(alice);
    await repos.members.insert(bob);

    const list = await repos.members.listByStudio(studioId);
    expect(list.map((m) => m.id)).toEqual(["mem_bob", "mem_alice"]);

    expect(await repos.members.getById("mem_alice")).toEqual(alice);
    expect(await repos.members.findByEmail(studioId, "bob@example.com")).toEqual(bob);
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();

    const updated = await repos.members.update("mem_alice", { status: "paused" });
    expect(updated.status).toBe("paused");
    expect((await repos.members.getById("mem_alice"))?.status).toBe("paused");
  });

  it("classTypes + classSessions: insert, list, getById, range filter", async () => {
    const classType = {
      id: "ct_yoga",
      studioId,
      name: "Yoga",
      description: null,
      color: "#111111",
      defaultCapacity: 10,
      defaultPriceCents: 1500,
      createdAt: NOW.toISOString(),
    };
    await repos.classTypes.insert(classType);
    expect(await repos.classTypes.getById("ct_yoga")).toEqual(classType);
    expect((await repos.classTypes.listByStudio(studioId)).map((c) => c.id)).toContain("ct_yoga");

    const sessionA = {
      id: "sess_a",
      studioId,
      classTypeId: "ct_yoga",
      instructor: "Sam",
      startsAt: "2026-04-01T09:00:00.000Z",
      endsAt: "2026-04-01T10:00:00.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    };
    const sessionB = {
      id: "sess_b",
      studioId,
      classTypeId: "ct_yoga",
      instructor: "Sam",
      startsAt: "2026-04-02T09:00:00.000Z",
      endsAt: "2026-04-02T10:00:00.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    };
    await repos.classSessions.insert(sessionA);
    await repos.classSessions.insert(sessionB);

    expect(await repos.classSessions.getById("sess_a")).toEqual(sessionA);
    const windowed = await repos.classSessions.listByStudio(studioId, {
      from: "2026-04-02T00:00:00.000Z",
      to: "2026-04-03T00:00:00.000Z",
    });
    expect(windowed.map((s) => s.id)).toEqual(["sess_b"]);
  });

  it("bookings: insert, getById, listBySession, listBySessionIds, update", async () => {
    const booking = {
      id: "bkg_1",
      sessionId: "sess_a",
      memberId: "mem_bob",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking);
    expect(await repos.bookings.getById("bkg_1")).toEqual(booking);
    expect((await repos.bookings.listBySession("sess_a")).map((b) => b.id)).toEqual(["bkg_1"]);
    expect((await repos.bookings.listBySessionIds(["sess_a", "sess_b"])).map((b) => b.id)).toEqual([
      "bkg_1",
    ]);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);

    const cancelled = await repos.bookings.update("bkg_1", {
      status: "cancelled",
      cancelledAt: NOW.toISOString(),
    });
    expect(cancelled.status).toBe("cancelled");
  });

  it("invoices + line items: insert, list, getById, countByStudio, update, insertMany", async () => {
    const invoice = {
      id: "inv_1",
      studioId,
      memberId: "mem_bob",
      number: "INV-0001",
      status: "draft",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 1500,
      taxCents: 0,
      totalCents: 1500,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    };
    await repos.invoices.insert(invoice);
    expect(await repos.invoices.getById("inv_1")).toEqual(invoice);
    expect(await repos.invoices.countByStudio(studioId)).toBe(1);
    expect((await repos.invoices.listByStudio(studioId)).map((i) => i.id)).toEqual(["inv_1"]);

    const paid = await repos.invoices.update("inv_1", {
      status: "paid",
      paidAt: NOW.toISOString(),
    });
    expect(paid.status).toBe("paid");

    const lineItems = [
      {
        id: "li_1",
        invoiceId: "inv_1",
        description: "Class booking",
        quantity: 1,
        unitAmountCents: 1500,
        amountCents: 1500,
        refunded: false,
        bookingId: "bkg_1",
      },
    ];
    const inserted = await repos.invoiceLineItems.insertMany(lineItems);
    expect(inserted).toEqual(lineItems);
    expect(await repos.invoiceLineItems.listByInvoice("inv_1")).toEqual(lineItems);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("outbox: insert, listPending (only unsent), update", async () => {
    const row = {
      id: "out_1",
      memberId: "mem_bob",
      kind: "booking_confirmation",
      payload: "{}",
      createdAt: NOW.toISOString(),
      sentAt: null,
      providerMessageId: null,
      error: null,
    };
    await repos.outbox.insert(row);
    expect((await repos.outbox.listPending()).map((r) => r.id)).toContain("out_1");

    const sent = await repos.outbox.update("out_1", {
      sentAt: NOW.toISOString(),
      providerMessageId: "msg_123",
    });
    expect(sent.providerMessageId).toBe("msg_123");
    expect((await repos.outbox.listPending()).map((r) => r.id)).not.toContain("out_1");
  });
});
