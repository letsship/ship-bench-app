import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { ClassSession, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { cancelBooking, createBooking } from "@/lib/services/bookings";
import { createFakeTracker, type FakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";

const NOW = new Date();

const isFuture = (session: ClassSession): boolean => new Date(session.startsAt) > NOW;

async function findOpenBooking(repos: ReturnType<typeof createInMemoryRepositories>) {
  const studio = await repos.studios.getFirst();
  if (!studio) throw new Error("Seed studio is missing");
  const members = await repos.members.listByStudio(studio.id);
  const sessions = await repos.classSessions.listByStudio(studio.id);

  for (const session of sessions.filter(isFuture)) {
    const bookingMemberIds = new Set((await repos.bookings.listBySession(session.id)).map((b) => b.memberId));
    const member = members.find(
      (candidate) => candidate.status === "active" && !bookingMemberIds.has(candidate.id),
    );
    if (member && bookingMemberIds.size < session.capacity) return { member, session };
  }
  throw new Error("Seed has no open future session");
}

async function findFullBooking(repos: ReturnType<typeof createInMemoryRepositories>) {
  const studio = await repos.studios.getFirst();
  if (!studio) throw new Error("Seed studio is missing");
  const sessions = await repos.classSessions.listByStudio(studio.id);

  for (const session of sessions.filter(isFuture)) {
    const bookings = await repos.bookings.listBySession(session.id);
    if (bookings.filter((booking) => booking.status === "booked").length >= session.capacity) {
      const member: Member = {
        id: `analytics-member-${session.id}`,
        studioId: studio.id,
        name: "Analytics member",
        email: "analytics-member@example.com",
        phone: "+1 555 0100",
        status: "active",
        notificationsOptedOut: false,
        createdAt: NOW.toISOString(),
      };
      await repos.members.insert(member);
      return { member, session };
    }
  }
  throw new Error("Seed has no full future session");
}

function expectEventWithoutPii(
  tracker: FakeTracker,
  event: "booking_created" | "waitlist_joined" | "booking_cancelled",
  member: Member,
  session: ClassSession,
): void {
  expect(tracker.captured).toHaveLength(1);
  expect(tracker.captured[0]).toMatchObject({
    event,
    distinctId: member.id,
    properties: { session_id: session.id },
  });
  const properties = JSON.stringify(tracker.captured[0].properties);
  expect(properties).not.toContain(member.email);
  expect(properties).not.toContain(member.name);
  if (member.phone) expect(properties).not.toContain(member.phone);
}

describe("booking analytics events", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  let tracker: FakeTracker;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    tracker = createFakeTracker();
    __setTestRepositories(repos);
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
  });

  it("captures booking_created once for a confirmed booking", async () => {
    const { member, session } = await findOpenBooking(repos);

    await createBooking(repos, createFakeProvider(), resolveTracker(), {
      memberId: member.id,
      sessionId: session.id,
    });

    expectEventWithoutPii(tracker, "booking_created", member, session);
    expect(tracker.captured.map((capture) => capture.event)).not.toContain("waitlist_joined");
  });

  it("captures waitlist_joined once for a waitlisted booking", async () => {
    const { member, session } = await findFullBooking(repos);

    await createBooking(repos, createFakeProvider(), resolveTracker(), {
      memberId: member.id,
      sessionId: session.id,
    });

    expectEventWithoutPii(tracker, "waitlist_joined", member, session);
    expect(tracker.captured.map((capture) => capture.event)).not.toContain("booking_created");
  });

  it("captures booking_cancelled once for a cancellation", async () => {
    const { member, session } = await findOpenBooking(repos);
    const booking = await createBooking(repos, createFakeProvider(), resolveTracker(), {
      memberId: member.id,
      sessionId: session.id,
    });
    tracker.captured.splice(0);

    await cancelBooking(repos, createFakeProvider(), resolveTracker(), booking.bookingId);

    expectEventWithoutPii(tracker, "booking_cancelled", member, session);
  });
});
