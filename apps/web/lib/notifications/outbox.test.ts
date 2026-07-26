import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { bookingConfirmation } from "./messages";
import { dispatchOutbox, enqueueAndDispatch, enqueueNotification, shouldSend } from "./outbox";
import type { NotificationMessage, NotificationProvider } from "./types";

const ISO = "2026-03-15T12:00:00.000Z";
const recipient = { memberId: "m1", email: "m1@e.co", name: "M1" };
const message = (): NotificationMessage =>
  bookingConfirmation(recipient, { title: "Yoga", startsAt: ISO, instructor: "I" });

function seedWith(
  memberOverrides: Partial<SeedData["members"][number]> = {},
  settingsOverrides: Partial<SeedData["settings"]> = {},
): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
      ...settingsOverrides,
    },
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "M1",
        email: "m1@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: ISO,
        ...memberOverrides,
      },
    ],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    packages: [],
  };
}

const recorder = (): NotificationProvider & { sent: NotificationMessage[] } => {
  const sent: NotificationMessage[] = [];
  return {
    name: "rec",
    sent,
    async send(sent_message) {
      sent.push(sent_message);
      return { providerMessageId: "rec_1" };
    },
  };
};

describe("shouldSend", () => {
  const base = {
    memberOptedOut: false,
    notifyBookingConfirmations: true,
    notifyCancellations: false,
    notifyWaitlistPromotions: true,
    notifyInvoices: false,
  };

  it("respects the per-kind studio setting", () => {
    expect(shouldSend("booking_confirmation", base)).toBe(true);
    expect(shouldSend("booking_cancellation", base)).toBe(false);
    expect(shouldSend("waitlist_promotion", base)).toBe(true);
    expect(shouldSend("invoice_issued", base)).toBe(false);
  });

  it("member opt-out wins over every setting", () => {
    expect(shouldSend("booking_confirmation", { ...base, memberOptedOut: true })).toBe(false);
  });
});

describe("dispatchOutbox", () => {
  it("delivers a pending row and stamps sentAt + provider id", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const provider = recorder();
    await enqueueNotification(repos, message());

    const summary = await dispatchOutbox(repos, provider);
    expect(summary).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(provider.sent).toHaveLength(1);
    expect(await repos.outbox.listPending()).toHaveLength(0);
  });

  it("skips an opted-out member without calling the provider", async () => {
    const repos = createInMemoryRepositories(seedWith({ notificationsOptedOut: true }));
    const provider = recorder();
    await enqueueNotification(repos, message());

    const summary = await dispatchOutbox(repos, provider);
    expect(summary).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(provider.sent).toHaveLength(0);
  });

  it("skips when the studio setting for the kind is off", async () => {
    const repos = createInMemoryRepositories(seedWith({}, { notifyBookingConfirmations: false }));
    const provider = recorder();
    await enqueueNotification(repos, message());

    const summary = await dispatchOutbox(repos, provider);
    expect(summary).toEqual({ sent: 0, skipped: 1, failed: 0 });
  });

  it("records a delivery failure and leaves the row retryable", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const failing: NotificationProvider = {
      name: "x",
      async send() {
        throw new Error("boom");
      },
    };
    await enqueueNotification(repos, message());

    const summary = await dispatchOutbox(repos, failing);
    expect(summary).toEqual({ sent: 0, skipped: 0, failed: 1 });
    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].error).toBe("boom");
  });

  it("enqueueAndDispatch enqueues then delivers in one call", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const provider = recorder();
    const summary = await enqueueAndDispatch(repos, provider, message());
    expect(summary.sent).toBe(1);
  });
});
