import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteBooking } from "@/app/api/bookings/[id]/route";
import { POST as createBooking } from "@/app/api/bookings/route";
import { __setTestTracker } from "@/lib/analytics";
import { createFakeTracker, type FakeTracker } from "@/lib/analytics/fake-tracker";
import type { AnalyticsEventName, CaptureEvent } from "@/lib/analytics/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { ClassSession, Member } from "@/lib/db/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "operator@example.com" })),
}));

const TEST_NOW = new Date("2030-08-01T12:00:00.000Z");
const previousFakeBackends = process.env.USE_FAKE_BACKENDS;

interface Fixture {
  seed: SeedData;
  member: Member;
  otherMember: Member;
  session: ClassSession;
}

function createFixture(capacity = 2): Fixture {
  const seed = buildSeed(TEST_NOW);
  const activeMembers = seed.members.filter((member) => member.status === "active");
  const member = activeMembers[0];
  const otherMember = activeMembers[1];
  const session = { ...seed.sessions[seed.sessions.length - 1], capacity };
  return {
    member,
    otherMember,
    session,
    seed: {
      ...seed,
      sessions: [session],
      bookings: [],
      invoices: [],
      lineItems: [],
      outbox: [],
    },
  };
}

function installFixture(seed: SeedData): FakeTracker {
  const tracker = createFakeTracker();
  __setTestRepositories(createInMemoryRepositories(seed));
  __setTestTracker(tracker);
  return tracker;
}

function expectEvent(
  event: CaptureEvent,
  name: AnalyticsEventName,
  member: Member,
  session: ClassSession,
): void {
  expect(event).toEqual({
    distinctId: member.id,
    event: name,
    properties: { session_id: session.id },
  });

  const properties = JSON.stringify(event.properties);
  for (const value of [member.email, member.name, member.phone]) {
    if (value) expect(properties).not.toContain(value);
  }
}

async function postBooking(memberId: string, sessionId: string): Promise<Response> {
  return createBooking(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, sessionId }),
    }),
  );
}

describe("booking funnel analytics", () => {
  beforeEach(() => {
    process.env.USE_FAKE_BACKENDS = "1";
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
    if (previousFakeBackends === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = previousFakeBackends;
  });

  it("captures booking_created once for a confirmed booking", async () => {
    const fixture = createFixture();
    const tracker = installFixture(fixture.seed);

    const response = await postBooking(fixture.member.id, fixture.session.id);

    expect(response.status).toBe(201);
    expect(tracker.captured.map((event) => event.event)).toEqual(["booking_created"]);
    expectEvent(tracker.captured[0], "booking_created", fixture.member, fixture.session);
  });

  it("captures waitlist_joined once, without booking_created, when full", async () => {
    const fixture = createFixture(1);
    fixture.seed.bookings = [
      {
        id: "existing-booking",
        sessionId: fixture.session.id,
        memberId: fixture.otherMember.id,
        status: "booked",
        bookedAt: TEST_NOW.toISOString(),
        cancelledAt: null,
      },
    ];
    const tracker = installFixture(fixture.seed);

    const response = await postBooking(fixture.member.id, fixture.session.id);

    expect(response.status).toBe(201);
    expect(tracker.captured.map((event) => event.event)).toEqual(["waitlist_joined"]);
    expectEvent(tracker.captured[0], "waitlist_joined", fixture.member, fixture.session);
  });

  it("captures booking_cancelled once for a cancellation", async () => {
    const fixture = createFixture();
    fixture.seed.bookings = [
      {
        id: "booking-to-cancel",
        sessionId: fixture.session.id,
        memberId: fixture.member.id,
        status: "booked",
        bookedAt: TEST_NOW.toISOString(),
        cancelledAt: null,
      },
    ];
    const tracker = installFixture(fixture.seed);

    const response = await deleteBooking(
      new Request("http://localhost/api/bookings/booking-to-cancel"),
      { params: Promise.resolve({ id: "booking-to-cancel" }) },
    );

    expect(response.status).toBe(200);
    expect(tracker.captured.map((event) => event.event)).toEqual(["booking_cancelled"]);
    expectEvent(tracker.captured[0], "booking_cancelled", fixture.member, fixture.session);
  });
});
