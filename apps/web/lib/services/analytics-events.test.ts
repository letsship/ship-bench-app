import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { __setTestRepositories } from "@/lib/db/repos/index";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { POST } from "@/app/api/bookings/route";
import { DELETE } from "@/app/api/bookings/[id]/route";

// The route handlers call `createNotificationProvider()` which reads
// process.env.USE_FAKE_BACKENDS and process.env.RESEND_API_KEY.  In tests we
// have neither real credentials nor the env flag, so override the dependency
// by setting the flag before any module reads provider.ts.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue(undefined),
}));

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(
  over: Partial<{
    studio: { id: string; name: string; slug: string; timezone: string; createdAt: string };
    settings: Record<string, unknown>;
    members: Member[];
    classTypes: ClassType[];
    sessions: ClassSession[];
    bookings: Booking[];
  }> = {},
) {
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
  name: id,
  email: `${id}@e.co`,
  phone: null,
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

function request(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("analytics events via route handlers", () => {
  let repos: Repositories;
  let tracker: ReturnType<typeof createFakeTracker>;

  beforeEach(() => {
    process.env.USE_FAKE_BACKENDS = "1";
    repos = createInMemoryRepositories(baseSeed());
    __setTestRepositories(repos);
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("captures booking_created for a confirmed booking (not waitlist_joined)", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 2 })],
        members: [member("m1")],
      }),
    );
    __setTestRepositories(repos);

    const res = await POST(request({ sessionId: "cs1", memberId: "m1" }));
    expect(res.status).toBe(201);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
    // Not waitlist_joined
    expect(tracker.captured[0].event).not.toBe("waitlist_joined");
  });

  it("captures waitlist_joined when the session is full (not booking_created)", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    __setTestRepositories(repos);

    const res = await POST(request({ sessionId: "cs1", memberId: "m2" }));
    expect(res.status).toBe(201);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("waitlist_joined");
    expect(tracker.captured[0].distinctId).toBe("m2");
    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
    // Not booking_created
    expect(tracker.captured[0].event).not.toBe("booking_created");
  });

  it("captures booking_cancelled when a booking is cancelled", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    __setTestRepositories(repos);

    const res = await DELETE(
      new Request("http://localhost/api/bookings/b1"),
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(res.status).toBe(200);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_cancelled");
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
  });

  it("does not include PII (email, name, phone) in any event properties", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 2 })],
        members: [member("m1")],
      }),
    );
    __setTestRepositories(repos);

    await POST(request({ sessionId: "cs1", memberId: "m1" }));
    expect(tracker.captured.length).toBeGreaterThan(0);

    for (const event of tracker.captured) {
      const props = event.properties ?? {};
      expect(props).not.toHaveProperty("email");
      expect(props).not.toHaveProperty("name");
      expect(props).not.toHaveProperty("phone");
    }
  });
});