import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteBooking } from "@/app/api/bookings/[id]/route";
import { POST as postBooking } from "@/app/api/bookings/route";
import { type RecordingTracker, createRecordingTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

// Auth is stubbed at its seam: next/headers cookies() throws outside a request
// scope under vitest, and sign-in is not what this spec exercises. The routes
// are otherwise driven end-to-end (handle → service → repos → tracker).
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...original,
    requireSession: async () => ({ email: "ops@riverbank.studio" }),
  };
});

// Anchored to the real clock: the booking/cancellation rules compare against
// `new Date()` inside the services, so fixtures must be genuinely future.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

// Distinctive PII on every member, so the no-PII assertion has teeth.
const MEMBERS: Member[] = [
  {
    id: "m1",
    studioId: "s1",
    name: "Amara Okafor",
    email: "amara@example.com",
    phone: "+31 6 1200 0001",
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  },
  {
    id: "m2",
    studioId: "s1",
    name: "Bram de Vries",
    email: "bram@example.com",
    phone: "+31 6 1200 0002",
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  },
  {
    id: "m3",
    studioId: "s1",
    name: "Chiara Rossi",
    email: "chiara@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  },
];

const CLASS_TYPE: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#5b8c5a",
  defaultCapacity: 10,
  defaultPriceCents: 1800,
  createdAt: ISO,
};

const session = (id: string, capacity: number): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity,
  priceCents: 1800,
  status: "scheduled",
  createdAt: ISO,
});

const booking = (id: string, sessionId: string, memberId: string, status: string): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: ISO,
  cancelledAt: null,
});

function seed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: MEMBERS,
    classTypes: [CLASS_TYPE],
    sessions: [session("cs-open", 10), session("cs-full", 1)],
    bookings: [
      booking("b-seat", "cs-full", "m2", "booked"),
      booking("b-wait", "cs-full", "m3", "waitlisted"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

const postJson = (body: unknown): Request =>
  new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const cancelRequest = (id: string): [Request, { params: Promise<{ id: string }> }] => [
  new Request(`http://localhost/api/bookings/${id}`, { method: "DELETE" }),
  { params: Promise.resolve({ id }) },
];

function expectNoPii(events: AnalyticsEvent[]): void {
  const json = JSON.stringify(events);
  for (const member of MEMBERS) {
    expect(json).not.toContain(member.email);
    expect(json).not.toContain(member.name);
    if (member.phone) expect(json).not.toContain(member.phone);
  }
}

describe("booking funnel analytics (route-driven)", () => {
  let tracker: RecordingTracker;

  beforeEach(() => {
    // The route constructs its notification provider from env — use the fake.
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    __setTestRepositories(createInMemoryRepositories(seed()));
    tracker = createRecordingTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  it("captures exactly one booking_created for a confirmed booking, attributed to member + session", async () => {
    const res = await postBooking(postJson({ sessionId: "cs-open", memberId: "m1" }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("booked");

    expect(tracker.captured).toEqual([
      { event: "booking_created", distinctId: "m1", properties: { session_id: "cs-open" } },
    ]);
    expect(tracker.captured.some((event) => event.event === "waitlist_joined")).toBe(false);
    expectNoPii(tracker.captured);
  });

  it("captures exactly one waitlist_joined for a waitlisted booking — and no booking_created", async () => {
    const res = await postBooking(postJson({ sessionId: "cs-full", memberId: "m1" }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("waitlisted");

    expect(tracker.captured).toEqual([
      { event: "waitlist_joined", distinctId: "m1", properties: { session_id: "cs-full" } },
    ]);
    expect(tracker.captured.some((event) => event.event === "booking_created")).toBe(false);
    expectNoPii(tracker.captured);
  });

  it("captures exactly one booking_cancelled for a cancellation — a waitlist promotion is not a conversion", async () => {
    const res = await deleteBooking(...cancelRequest("b-seat"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { promotedMemberId: string | null }).promotedMemberId).toBe("m3");

    expect(tracker.captured).toEqual([
      { event: "booking_cancelled", distinctId: "m2", properties: { session_id: "cs-full" } },
    ]);
    expect(tracker.captured.some((event) => event.event === "booking_created")).toBe(false);
    expectNoPii(tracker.captured);
  });
});
