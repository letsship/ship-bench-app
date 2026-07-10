import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Repository test for the Drizzle-over-D1 implementation, run against a real
// D1 binding via @cloudflare/vitest-pool-workers (Miniflare-backed — hermetic,
// no native SQLite dependency). Mirrors the operations fakes.test.ts covers.
// `studios`/`studioSettings` have no repo insert method (the app only ever
// reads/updates them; they're seeded once), so fixtures for those two go
// through Drizzle directly — everything else goes through the repo methods
// under test.

const NOW = "2026-03-15T12:00:00.000Z";

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    const db = drizzle(env.DB, { schema });
    studioId = "studio_1";
    await db.insert(schema.studios).values({
      id: studioId,
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: NOW,
    });
    await db.insert(schema.studioSettings).values({
      studioId,
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    });
    repos = createD1Repositories(env.DB);
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("settings.update returns the patched row", async () => {
    const updated = await repos.settings.update(studioId, { currency: "USD" });
    expect(updated.currency).toBe("USD");
    expect(await repos.settings.getByStudioId(studioId)).toMatchObject({ currency: "USD" });
  });

  it("inserts members, reads back by id, and lists sorted by name", async () => {
    await repos.members.insert({
      id: "mem_b",
      studioId,
      name: "Bram de Vries",
      email: "bram@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    await repos.members.insert({
      id: "mem_a",
      studioId,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });

    expect((await repos.members.getById("mem_a"))?.name).toBe("Amara Okafor");
    const listed = await repos.members.listByStudio(studioId);
    expect(listed.map((m) => m.name)).toEqual(["Amara Okafor", "Bram de Vries"]);
  });

  it("finds a member by email within the studio", async () => {
    await repos.members.insert({
      id: "mem_a",
      studioId,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    expect((await repos.members.findByEmail(studioId, "amara@example.com"))?.name).toBe(
      "Amara Okafor",
    );
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("member update patches only the given fields", async () => {
    await repos.members.insert({
      id: "mem_a",
      studioId,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    const updated = await repos.members.update("mem_a", { status: "paused" });
    expect(updated.status).toBe("paused");
    expect(updated.name).toBe("Amara Okafor");
  });

  it("class types and sessions: insert, list, getById, range filter", async () => {
    const classType = await repos.classTypes.insert({
      id: "ct_1",
      studioId,
      name: "Vinyasa Flow",
      description: null,
      color: "#5b8c5a",
      defaultCapacity: 16,
      defaultPriceCents: 1800,
      createdAt: NOW,
    });
    expect(await repos.classTypes.getById(classType.id)).toEqual(classType);
    expect((await repos.classTypes.listByStudio(studioId)).map((c) => c.id)).toEqual([
      classType.id,
    ]);

    const session = await repos.classSessions.insert({
      id: "sess_1",
      studioId,
      classTypeId: classType.id,
      instructor: "Noor",
      startsAt: "2026-03-16T09:00:00.000Z",
      endsAt: "2026-03-16T10:00:00.000Z",
      capacity: 16,
      priceCents: 1800,
      status: "scheduled",
      createdAt: NOW,
    });
    expect(await repos.classSessions.getById(session.id)).toEqual(session);

    const windowed = await repos.classSessions.listByStudio(studioId, {
      from: "2026-03-16T00:00:00.000Z",
      to: "2026-03-17T00:00:00.000Z",
    });
    expect(windowed.map((s) => s.id)).toEqual([session.id]);
    expect(
      await repos.classSessions.listByStudio(studioId, { from: "2026-03-17T00:00:00.000Z" }),
    ).toEqual([]);
  });

  it("bookings.listBySessionIds returns [] for an empty id list", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("bookings: insert, update, list by session and by session ids", async () => {
    const classType = await repos.classTypes.insert({
      id: "ct_1",
      studioId,
      name: "Vinyasa Flow",
      description: null,
      color: "#5b8c5a",
      defaultCapacity: 16,
      defaultPriceCents: 1800,
      createdAt: NOW,
    });
    const session = await repos.classSessions.insert({
      id: "sess_1",
      studioId,
      classTypeId: classType.id,
      instructor: "Noor",
      startsAt: "2026-03-16T09:00:00.000Z",
      endsAt: "2026-03-16T10:00:00.000Z",
      capacity: 16,
      priceCents: 1800,
      status: "scheduled",
      createdAt: NOW,
    });
    const member = await repos.members.insert({
      id: "mem_a",
      studioId,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    const booking = await repos.bookings.insert({
      id: "bk_1",
      sessionId: session.id,
      memberId: member.id,
      status: "booked",
      bookedAt: NOW,
      cancelledAt: null,
    });
    expect(await repos.bookings.getById(booking.id)).toEqual(booking);
    expect((await repos.bookings.listBySession(session.id)).map((b) => b.id)).toEqual([booking.id]);
    expect((await repos.bookings.listBySessionIds([session.id])).map((b) => b.id)).toEqual([
      booking.id,
    ]);

    const cancelled = await repos.bookings.update(booking.id, {
      status: "cancelled",
      cancelledAt: NOW,
    });
    expect(cancelled.status).toBe("cancelled");
  });

  it("invoices + line items: insert, list ordering, count, insertMany", async () => {
    const member = await repos.members.insert({
      id: "mem_a",
      studioId,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    const older = await repos.invoices.insert({
      id: "inv_1",
      studioId,
      memberId: member.id,
      number: "INV-0001",
      status: "draft",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 1800,
      taxCents: 0,
      totalCents: 1800,
      issuedAt: "2026-03-01T00:00:00.000Z",
      dueAt: null,
      paidAt: null,
      createdAt: NOW,
    });
    const newer = await repos.invoices.insert({
      id: "inv_2",
      studioId,
      memberId: member.id,
      number: "INV-0002",
      status: "draft",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 2600,
      taxCents: 0,
      totalCents: 2600,
      issuedAt: "2026-03-10T00:00:00.000Z",
      dueAt: null,
      paidAt: null,
      createdAt: NOW,
    });

    const listed = await repos.invoices.listByStudio(studioId);
    expect(listed.map((i) => i.id)).toEqual([newer.id, older.id]);
    expect(await repos.invoices.countByStudio(studioId)).toBe(2);

    const updated = await repos.invoices.update(older.id, { status: "paid", paidAt: NOW });
    expect(updated.status).toBe("paid");

    const items = await repos.invoiceLineItems.insertMany([
      {
        id: "li_1",
        invoiceId: older.id,
        description: "Vinyasa Flow",
        quantity: 1,
        unitAmountCents: 1800,
        amountCents: 1800,
        refunded: false,
        bookingId: null,
      },
    ]);
    expect(items).toHaveLength(1);
    expect((await repos.invoiceLineItems.listByInvoice(older.id)).map((i) => i.id)).toEqual([
      "li_1",
    ]);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("outbox: insert, listPending, update", async () => {
    const member = await repos.members.insert({
      id: "mem_a",
      studioId,
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    const row = await repos.outbox.insert({
      id: "out_1",
      memberId: member.id,
      kind: "booking_confirmation",
      payload: "{}",
      createdAt: NOW,
      sentAt: null,
      providerMessageId: null,
      error: null,
    });
    expect(await repos.outbox.listPending()).toEqual([row]);

    const sent = await repos.outbox.update(row.id, { sentAt: NOW, providerMessageId: "msg_123" });
    expect(sent.sentAt).toBe(NOW);
    expect(await repos.outbox.listPending()).toEqual([]);
  });
});
