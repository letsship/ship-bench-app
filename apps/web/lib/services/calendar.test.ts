import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession } from "@/lib/db/types";
import { memberCalendarEvents } from "./calendar";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function booking(
  id: string,
  sessionId: string,
  memberId: string,
  status: string,
): Booking {
  return {
    id,
    sessionId,
    memberId,
    status,
    bookedAt: NOW.toISOString(),
    cancelledAt: status === "cancelled" ? NOW.toISOString() : null,
  };
}

function session(
  base: ClassSession,
  id: string,
  startsAt: string,
  endsAt: string,
): ClassSession {
  return { ...base, id, startsAt, endsAt };
}

function calendarSeed() {
  const seed = buildSeed(NOW);
  const [member, otherMember] = seed.members;
  const classType = seed.classTypes[0];
  const base = seed.sessions[0];
  const futureBooked = session(
    base,
    "future-booked",
    "2026-03-16T10:00:00.000Z",
    "2026-03-16T11:00:00.000Z",
  );
  const futureOther = session(
    base,
    "future-other",
    "2026-03-17T10:00:00.000Z",
    "2026-03-17T11:00:00.000Z",
  );
  const pastBooked = session(
    base,
    "past-booked",
    "2026-03-14T10:00:00.000Z",
    "2026-03-14T11:00:00.000Z",
  );
  const futureWaitlisted = session(
    base,
    "future-waitlisted",
    "2026-03-18T10:00:00.000Z",
    "2026-03-18T11:00:00.000Z",
  );
  const futureCancelled = session(
    base,
    "future-cancelled",
    "2026-03-19T10:00:00.000Z",
    "2026-03-19T11:00:00.000Z",
  );

  seed.sessions = [futureBooked, futureOther, pastBooked, futureWaitlisted, futureCancelled].map(
    (classSession) => ({ ...classSession, classTypeId: classType.id }),
  );
  seed.bookings = [
    booking("booking-future-booked", futureBooked.id, member.id, "booked"),
    booking("booking-future-other", futureOther.id, otherMember.id, "booked"),
    booking("booking-past-booked", pastBooked.id, member.id, "booked"),
    booking("booking-future-waitlisted", futureWaitlisted.id, member.id, "waitlisted"),
    booking("booking-future-cancelled", futureCancelled.id, member.id, "cancelled"),
  ];

  return { seed, member, classType, futureBooked };
}

describe("memberCalendarEvents", () => {
  it("returns only the token holder's upcoming booked sessions", async () => {
    const { seed, member, classType, futureBooked } = calendarSeed();
    const events = await memberCalendarEvents(
      createInMemoryRepositories(seed),
      seed.studio.id,
      member.calendarToken,
      NOW,
    );

    expect(events).toEqual([
      {
        uid: `${futureBooked.id}@studiobook`,
        title: classType.name,
        startsAt: futureBooked.startsAt,
        endsAt: futureBooked.endsAt,
        description: `Instructor: ${futureBooked.instructor}`,
      },
    ]);
  });

  it("returns null for empty and unknown tokens", async () => {
    const { seed } = calendarSeed();
    const repos = createInMemoryRepositories(seed);

    await expect(memberCalendarEvents(repos, seed.studio.id, "   ", NOW)).resolves.toBeNull();
    await expect(memberCalendarEvents(repos, seed.studio.id, "not-a-token", NOW)).resolves.toBeNull();
  });
});
