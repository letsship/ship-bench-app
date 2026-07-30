import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/bookings/[id]/route";
import { POST } from "@/app/api/bookings/route";
import { __setTestTracker } from "@/lib/analytics";
import { createFakeTracker, type FakeTracker } from "@/lib/analytics/fake-tracker";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { __setTestRepositories } from "@/lib/db/repos";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member, Studio, StudioSettings } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";

// The booking routes require a signed-in operator and a notification provider.
// We stub the auth seam and the notification provider so the test drives the
// real route handlers (and the real analytics composition root) hermetically,
// with no network, no Supabase, and no Resend.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "operator@example.com" }),
}));
vi.mock("@/lib/notifications/provider", () => ({
  createNotificationProvider: () => createFakeProvider(),
}));

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function seed(): SeedData {
  const studio: Studio = {
    id: "s1",
    name: "S",
    slug: "s",
    timezone: "Europe/Amsterdam",
    createdAt: ISO,
  };
  const settings: StudioSettings = {
    studioId: "s1",
    currency: "EUR",
    taxRateBps: 900,
    cancellationWindowHours: 12,
    waitlistEnabled: true,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  };
  const member = (id: string, over: Partial<Member> = {}): Member => ({
    id,
    studioId: "s1",
    name: `Name ${id}`,
    email: `${id}@example.com`,
    phone: `+31 6 1200 ${id}`,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
    ...over,
  });
  const members = [member("m1"), member("m2"), member("m3")];
  const classType: ClassType = {
    id: "ct1",
    studioId: "s1",
    name: "Yoga",
    description: null,
    color: "#111111",
    defaultCapacity: 10,
    defaultPriceCents: 1000,
    createdAt: ISO,
  };
  const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
    id,
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "I",
    startsAt: FUTURE,
    endsAt: FUTURE_END,
    capacity: 10,
    priceCents: 1000,
    status: "scheduled",
    createdAt: ISO,
    ...over,
  });
  const sessions = [session("cs_open"), session("cs_full", { capacity: 1 })];
  const booking = (id: string, sessionId: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
    id,
    sessionId,
    memberId,
    status: "booked",
    bookedAt: ISO,
    cancelledAt: null,
    ...over,
  });
  const bookings = [
    booking("b_full1", "cs_full", "m2"),
    booking("b_full2", "cs_full", "m3", { status: "waitlisted", bookedAt: new Date(NOW.getTime() - 5 * 86_400_000).toISOString() }),
  ];
  return {
    studio,
    settings,
    members,
    classTypes: [classType],
    sessions,
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

// Every PII value present in the seed, used to prove none of it leaks into an
// event's properties.
const PII_VALUES = [
  "m1@example.com",
  "m2@example.com",
  "m3@example.com",
  "Name m1",
  "Name m2",
  "Name m3",
  "+31 6 1200 m1",
  "+31 6 1200 m2",
  "+31 6 1200 m3",
];

function assertNoPii(tracker: FakeTracker): void {
  for (const event of tracker.captured) {
    const props = event.properties ?? {};
    const serialized = JSON.stringify(props);
    for (const pii of PII_VALUES) {
      expect(serialized).not.toContain(pii);
    }
  }
}

describe("booking funnel analytics (route handlers + injected tracker)", () => {
  let tracker: FakeTracker;

  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(seed()));
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
  });

  it("a confirmed booking captures booking_created and not waitlist_joined", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "cs_open", memberId: "m1" }),
      }),
    );
    expect(res.status).toBe(201);

    const events = tracker.captured.map((e) => e.event);
    expect(events).toEqual(["booking_created"]);
    expect(events).not.toContain("waitlist_joined");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs_open" });
    assertNoPii(tracker);
  });

  it("a waitlisted booking captures waitlist_joined and not booking_created", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "cs_full", memberId: "m1" }),
      }),
    );
    expect(res.status).toBe(201);

    const events = tracker.captured.map((e) => e.event);
    expect(events).toEqual(["waitlist_joined"]);
    expect(events).not.toContain("booking_created");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs_full" });
    assertNoPii(tracker);
  });

  it("a cancellation captures booking_cancelled exactly once, with no promotion event", async () => {
    const res = await DELETE(new NextRequest("http://localhost/api/bookings/b_full1"), {
      params: Promise.resolve({ id: "b_full1" }),
    });
    expect(res.status).toBe(200);

    // Cancelling the booked seat promotes m3 off the waitlist, but that
    // promotion deliberately emits nothing — only booking_cancelled is captured.
    const events = tracker.captured.map((e) => e.event);
    expect(events).toEqual(["booking_cancelled"]);
    expect(events).not.toContain("booking_created");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].distinctId).toBe("m2");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs_full" });
    assertNoPii(tracker);
  });
});

// Sanity: the seed used above is independent of buildSeed, but buildSeed must
// still construct cleanly (it powers the fake-backends path the routes fall
// back to if the seams were unset).
describe("buildSeed still constructs", () => {
  it("returns a non-empty dataset", () => {
    const data = buildSeed(NOW);
    expect(data.members.length).toBeGreaterThan(0);
    expect(data.sessions.length).toBeGreaterThan(0);
  });
});
