import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { __setTestTracker } from "@/lib/analytics";
import { createRecordingTracker } from "@/lib/analytics/fake-tracker";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Anchored to the real clock: the booking/cancellation rules compare against
// `new Date()` inside the services, so fixtures must be genuinely future/past.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
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
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: `Member ${id}`,
  email: `${id}@example.com`,
  phone: "+1-555-0100",
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

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

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

async function mockAuthenticatedSession(): Promise<void> {
  const token = await createSessionToken("owner@example.com");
  const { cookies } = await import("next/headers");
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === SESSION_COOKIE ? { name, value: token } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function postBookingRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/bookings", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function assertNoPii(properties: Record<string, unknown> | undefined, member: Member): void {
  const values = Object.values(properties ?? {});
  expect(values).not.toContain(member.email);
  expect(values).not.toContain(member.name);
  expect(values).not.toContain(member.phone);
}

describe("analytics: booking funnel events (via the real route handlers)", () => {
  let tracker: ReturnType<typeof createRecordingTracker>;

  beforeEach(async () => {
    tracker = createRecordingTracker();
    __setTestTracker(tracker);
    // The notification provider still resolves independently of the tracker
    // seam; fake-backends mode keeps it from requiring a real Resend key.
    process.env.USE_FAKE_BACKENDS = "1";
    await mockAuthenticatedSession();
  });

  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("fires booking_created (and not waitlist_joined) for a confirmed booking", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
        }),
      ),
    );

    const res = await bookingsPost(postBookingRequest({ sessionId: "cs1", memberId: "m1" }));
    expect(res.status).toBe(201);

    expect(tracker.captured).toHaveLength(1);
    const [event] = tracker.captured;
    expect(event.event).toBe("booking_created");
    expect(event.distinctId).toBe("m1");
    expect(event.properties).toMatchObject({ session_id: "cs1" });
    expect(tracker.captured.some((e) => e.event === "waitlist_joined")).toBe(false);
    assertNoPii(event.properties, member("m1"));
  });

  it("fires waitlist_joined (and not booking_created) for a waitlisted booking", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1", { capacity: 1 })],
          members: [member("m1"), member("m2")],
          bookings: [booking("b1", "m1")],
        }),
      ),
    );

    const res = await bookingsPost(postBookingRequest({ sessionId: "cs1", memberId: "m2" }));
    expect(res.status).toBe(201);

    expect(tracker.captured).toHaveLength(1);
    const [event] = tracker.captured;
    expect(event.event).toBe("waitlist_joined");
    expect(event.distinctId).toBe("m2");
    expect(event.properties).toMatchObject({ session_id: "cs1" });
    expect(tracker.captured.some((e) => e.event === "booking_created")).toBe(false);
    assertNoPii(event.properties, member("m2"));
  });

  it("fires booking_cancelled exactly once for a cancellation", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
        }),
      ),
    );

    const res = await bookingsDelete(new Request("http://localhost/api/bookings/b1"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(res.status).toBe(200);

    expect(tracker.captured.filter((e) => e.event === "booking_cancelled")).toHaveLength(1);
    const [event] = tracker.captured;
    expect(event.event).toBe("booking_cancelled");
    expect(event.distinctId).toBe("m1");
    expect(event.properties).toMatchObject({ session_id: "cs1" });
    assertNoPii(event.properties, member("m1"));
  });
});
