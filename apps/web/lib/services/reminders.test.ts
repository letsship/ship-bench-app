import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { runReminders } from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";

function buildSeed(overrides: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "studio1", name: "S", slug: "s", timezone: "UTC", createdAt: NOW },
    settings: {
      studioId: "studio1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [
      { id: "m1", studioId: "studio1", name: "Active", email: "a@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: NOW },
      { id: "m2", studioId: "studio1", name: "OptedOut", email: "o@e.co", phone: null, status: "active", notificationsOptedOut: true, createdAt: NOW },
    ],
    classTypes: [
      { id: "ct1", studioId: "studio1", name: "Vinyasa", description: null, color: "#fff", defaultCapacity: 10, defaultPriceCents: 1000, createdAt: NOW },
    ],
    sessions: [
      // Within window: starts in 2 hours
      { id: "s1", studioId: "studio1", classTypeId: "ct1", instructor: "Noor", startsAt: "2026-03-15T14:00:00.000Z", endsAt: "2026-03-15T15:00:00.000Z", capacity: 10, priceCents: 1000, status: "scheduled", createdAt: NOW },
      // Outside window: starts in 48 hours
      { id: "s2", studioId: "studio1", classTypeId: "ct1", instructor: "Noor", startsAt: "2026-03-17T12:00:00.000Z", endsAt: "2026-03-17T13:00:00.000Z", capacity: 10, priceCents: 1000, status: "scheduled", createdAt: NOW },
    ],
    bookings: [
      { id: "b1", sessionId: "s1", memberId: "m1", status: "booked", bookedAt: NOW, cancelledAt: null },
      { id: "b2", sessionId: "s1", memberId: "m2", status: "booked", bookedAt: NOW, cancelledAt: null },
      { id: "b3", sessionId: "s2", memberId: "m1", status: "booked", bookedAt: NOW, cancelledAt: null },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...overrides,
  };
}

describe("runReminders", () => {
  let repos: Repositories;

  describe("confirmed seat within window", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(buildSeed());
    });

    it("queues a booking_reminder for a confirmed seat in the window", async () => {
      const summary = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary).toEqual({ queued: 1, skipped: 1 });

      const outbox = await repos.outbox.listByKind("booking_reminder");
      expect(outbox).toHaveLength(1);
      expect(outbox[0].kind).toBe("booking_reminder");
      expect(outbox[0].sentAt).toBeNull();
      const payload = JSON.parse(outbox[0].payload);
      expect(payload.data.bookingId).toBe("b1");
    });
  });

  describe("waitlisted seat", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(buildSeed({
        bookings: [
          { id: "b1", sessionId: "s1", memberId: "m1", status: "waitlisted", bookedAt: NOW, cancelledAt: null },
        ],
      }));
    });

    it("does not queue reminders for waitlisted members", async () => {
      const summary = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary).toEqual({ queued: 0, skipped: 0 });
    });
  });

  describe("opted-out member", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(buildSeed({
        bookings: [
          { id: "b1", sessionId: "s1", memberId: "m2", status: "booked", bookedAt: NOW, cancelledAt: null },
        ],
      }));
    });

    it("does not queue reminders for opted-out members", async () => {
      const summary = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary).toEqual({ queued: 0, skipped: 1 });
    });
  });

  describe("session outside the 24-hour window", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(buildSeed({
        bookings: [
          { id: "b1", sessionId: "s2", memberId: "m1", status: "booked", bookedAt: NOW, cancelledAt: null },
        ],
      }));
    });

    it("does not queue reminders for sessions outside the window", async () => {
      const summary = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary).toEqual({ queued: 0, skipped: 0 });
    });
  });

  describe("idempotency", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(buildSeed());
    });

    it("does not double-queue when a pending reminder already exists", async () => {
      await runReminders(repos, "studio1", { now: () => NOW });
      const summary2 = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary2).toEqual({ queued: 0, skipped: 2 });

      const outbox = await repos.outbox.listByKind("booking_reminder");
      expect(outbox).toHaveLength(1);
    });

    it("does not double-queue after the reminder has been sent", async () => {
      await runReminders(repos, "studio1", { now: () => NOW });
      const pending = await repos.outbox.listPending();
      await repos.outbox.update(pending[0].id, { sentAt: NOW, providerMessageId: "sent_1", error: null });

      const summary2 = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary2).toEqual({ queued: 0, skipped: 2 });

      const outbox = await repos.outbox.listByKind("booking_reminder");
      expect(outbox).toHaveLength(1);
    });
  });

  describe("no matching sessions", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(buildSeed({ sessions: [] }));
    });

    it("returns zeros when there are no sessions", async () => {
      const summary = await runReminders(repos, "studio1", { now: () => NOW });
      expect(summary).toEqual({ queued: 0, skipped: 0 });
    });
  });
});