import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as cancelBookingRoute } from "@/app/api/bookings/[id]/route";
import { POST as createBookingRoute } from "@/app/api/bookings/route";
import { type FakeTracker, createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import type { CaptureEvent } from "@/lib/analytics/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { ClassSession, Member } from "@/lib/db/types";

// The booking funnel, driven through the real route handlers with fake
// repositories and a recording tracker injected via the two test seams.

// The route handlers gate on an operator session; identity is irrelevant here.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireSession: async () => ({ email: "owner@riverbank.studio" }),
}));

// Anchored to the real clock: the booking rules compare against `new Date()`
// inside the service, so fixtures must be genuinely in the future.
const NOW = new Date();
const IN_A_WEEK = new Date(NOW.getTime() + 7 * 86_400_000);

let repos: Repositories;
let tracker: FakeTracker;
let counter = 0;

beforeEach(() => {
  // Fake backends keeps the notification provider off Resend; the injected
  // repositories and tracker take precedence over it either way.
  vi.stubEnv("USE_FAKE_BACKENDS", "1");
  repos = createInMemoryRepositories(buildSeed(NOW));
  tracker = createFakeTracker();
  __setTestTracker(tracker);
  __setTestRepositories(repos);
});

afterEach(() => {
  __setTestRepositories(null);
  __setTestTracker(null);
  vi.unstubAllEnvs();
});

const nextId = (prefix: string): string => `${prefix}_${(counter += 1)}`;

async function activeMembers(): Promise<Member[]> {
  const studio = await repos.studios.getFirst();
  const members = await repos.members.listByStudio(studio!.id);
  return members.filter((member) => member.status === "active");
}

// A future session of the given capacity, so "full" and "open" are exact rather
// than whatever the seed happens to produce.
async function addSession(capacity: number): Promise<ClassSession> {
  const studio = await repos.studios.getFirst();
  const [classType] = await repos.classTypes.listByStudio(studio!.id);
  return repos.classSessions.insert({
    id: nextId("cs_analytics"),
    studioId: studio!.id,
    classTypeId: classType.id,
    instructor: "Test",
    startsAt: IN_A_WEEK.toISOString(),
    endsAt: new Date(IN_A_WEEK.getTime() + 3_600_000).toISOString(),
    capacity,
    priceCents: 1000,
    status: "scheduled",
    createdAt: NOW.toISOString(),
  });
}

async function addBooking(sessionId: string, memberId: string, status: string): Promise<string> {
  const id = nextId("b_analytics");
  await repos.bookings.insert({
    id,
    sessionId,
    memberId,
    status,
    bookedAt: NOW.toISOString(),
    cancelledAt: null,
  });
  return id;
}

function post(body: unknown): Promise<Response> {
  return createBookingRoute(
    new Request("http://localhost/api/bookings", { method: "POST", body: JSON.stringify(body) }),
  );
}

function del(id: string): Promise<Response> {
  return cancelBookingRoute(
    new Request(`http://localhost/api/bookings/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  );
}

const names = (events: CaptureEvent[]): string[] => events.map((event) => event.event);

describe("booking funnel analytics", () => {
  it("captures exactly one booking_created when a booking is confirmed", async () => {
    const [member] = await activeMembers();
    const session = await addSession(1);

    const res = await post({ sessionId: session.id, memberId: member.id });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "booked" });
    expect(names(tracker.captured)).toEqual(["booking_created"]);
    expect(tracker.captured[0]).toEqual({
      event: "booking_created",
      distinctId: member.id,
      properties: { session_id: session.id },
    });
  });

  it("captures exactly one waitlist_joined — and no booking_created — when full", async () => {
    const [seated, joiner] = await activeMembers();
    const session = await addSession(1);
    await addBooking(session.id, seated.id, "booked");

    const res = await post({ sessionId: session.id, memberId: joiner.id });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "waitlisted" });
    expect(names(tracker.captured)).toEqual(["waitlist_joined"]);
    expect(tracker.captured[0]).toEqual({
      event: "waitlist_joined",
      distinctId: joiner.id,
      properties: { session_id: session.id },
    });
  });

  it("captures exactly one booking_cancelled when a booking is cancelled", async () => {
    const [member] = await activeMembers();
    const session = await addSession(1);
    const bookingId = await addBooking(session.id, member.id, "booked");

    const res = await del(bookingId);

    expect(res.status).toBe(200);
    expect(names(tracker.captured)).toEqual(["booking_cancelled"]);
    expect(tracker.captured[0]).toEqual({
      event: "booking_cancelled",
      distinctId: member.id,
      properties: { session_id: session.id },
    });
  });

  it("does not capture booking_created for the waitlist promotion a cancel triggers", async () => {
    const [seated, waiting] = await activeMembers();
    const session = await addSession(1);
    const bookingId = await addBooking(session.id, seated.id, "booked");
    await addBooking(session.id, waiting.id, "waitlisted");

    const res = await del(bookingId);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ promotedMemberId: waiting.id });
    // The promotion is a side effect of the cancel, not a member-initiated
    // booking — counting it would double-count the funnel.
    expect(names(tracker.captured)).toEqual(["booking_cancelled"]);
  });

  it("captures no personally-identifying data", async () => {
    const [seated, joiner] = await activeMembers();
    const open = await addSession(2);
    const full = await addSession(1);
    await addBooking(full.id, seated.id, "booked");
    const cancellable = await addBooking(open.id, seated.id, "booked");

    await post({ sessionId: open.id, memberId: joiner.id });
    await post({ sessionId: full.id, memberId: joiner.id });
    await del(cancellable);

    expect(names(tracker.captured)).toEqual([
      "booking_created",
      "waitlist_joined",
      "booking_cancelled",
    ]);

    const personal = (await activeMembers()).flatMap((member) =>
      [member.name, member.email, member.phone].filter((value): value is string => Boolean(value)),
    );
    const serialized = JSON.stringify(tracker.captured.map((event) => event.properties ?? {}));
    for (const value of personal) {
      expect(serialized).not.toContain(value);
    }
    // The distinct id identifies the member by id, never by email.
    for (const event of tracker.captured) {
      expect(event.distinctId).not.toContain("@");
    }
  });
});
