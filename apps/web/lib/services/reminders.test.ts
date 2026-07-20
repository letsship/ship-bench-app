import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { newId } from "@/lib/db/ids";
import type { ClassSession, Booking } from "@/lib/db/types";
import type { Repositories } from "@/lib/db/repos/types";
import { runReminders } from "./reminders";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("runReminders", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("queues one pending booking_reminder per confirmed seat in-window", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const target = sessions[0];
    const members = await repos.members.listByStudio(studioId);
    const member = members[0];

    const booking: Booking = {
      id: newId(),
      sessionId: target.id,
      memberId: member.id,
      status: "booked",
      bookedAt: new Date(NOW.getTime() - 86400000).toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking);

    await runReminders(repos, {
      now: () => new Date("2026-03-15T12:00:00.000Z").toISOString(),
    });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.length).toBeGreaterThan(0);
  });

  it("excludes waitlisted seats", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const target = sessions[0];
    const members = await repos.members.listByStudio(studioId);
    const member = members[0];

    const booking: Booking = {
      id: newId(),
      sessionId: target.id,
      memberId: member.id,
      status: "waitlisted",
      bookedAt: new Date(NOW.getTime() - 86400000).toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking);

    await runReminders(repos, {
      now: () => new Date("2026-03-15T12:00:00.000Z").toISOString(),
    });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    const payload = reminders.filter((r) => {
      const parsed = JSON.parse(r.payload) as { data?: { bookingId?: string } };
      return parsed.data?.bookingId === booking.id;
    });
    expect(payload).toHaveLength(0);
  });

  it("excludes out-of-window sessions", async () => {
    const members = await repos.members.listByStudio(studioId);
    const member = members[0];

    const futureSession: ClassSession = {
      id: newId(),
      studioId,
      classTypeId: "ct_unknown",
      instructor: "Future Instructor",
      startsAt: new Date(NOW.getTime() + 48 * 3600 * 1000).toISOString(),
      endsAt: new Date(NOW.getTime() + 49 * 3600 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    };
    await repos.classSessions.insert(futureSession);

    const booking: Booking = {
      id: newId(),
      sessionId: futureSession.id,
      memberId: member.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking);

    await runReminders(repos, {
      now: () => NOW.toISOString(),
    });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    const payload = reminders.filter((r) => {
      const parsed = JSON.parse(r.payload) as { data?: { bookingId?: string } };
      return parsed.data?.bookingId === booking.id;
    });
    expect(payload).toHaveLength(0);
  });

  it("excludes opted-out members", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const target = sessions[0];
    const members = await repos.members.listByStudio(studioId);
    const optedOut = members.find((m) => m.notificationsOptedOut);
    if (!optedOut) {
      throw new Error("No opted-out member in seed");
    }

    const booking: Booking = {
      id: newId(),
      sessionId: target.id,
      memberId: optedOut.id,
      status: "booked",
      bookedAt: new Date(NOW.getTime() - 86400000).toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking);

    await runReminders(repos, {
      now: () => NOW.toISOString(),
    });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    const payload = reminders.filter((r) => {
      const parsed = JSON.parse(r.payload) as { data?: { bookingId?: string } };
      return parsed.data?.bookingId === booking.id;
    });
    expect(payload).toHaveLength(0);
  });

  it("is idempotent: second run queues zero duplicates", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const target = sessions[0];
    const members = await repos.members.listByStudio(studioId);
    const member = members[0];

    const booking: Booking = {
      id: newId(),
      sessionId: target.id,
      memberId: member.id,
      status: "booked",
      bookedAt: new Date(NOW.getTime() - 86400000).toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking);

    await runReminders(repos, {
      now: () => NOW.toISOString(),
    });
    const countAfterFirst = await repos.outbox.listByKind("booking_reminder");

    const second = await runReminders(repos, {
      now: () => NOW.toISOString(),
    });
    const countAfterSecond = await repos.outbox.listByKind("booking_reminder");

    expect(countAfterSecond.length).toBe(countAfterFirst.length);
    expect(second.queued).toBe(0);
  });

  it("returns correct summary counts", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const target = sessions[0];
    const members = await repos.members.listByStudio(studioId);
    const member1 = members[0];
    const optedOut = members.find((m) => m.notificationsOptedOut);

    const booking1: Booking = {
      id: newId(),
      sessionId: target.id,
      memberId: member1.id,
      status: "booked",
      bookedAt: new Date(NOW.getTime() - 86400000).toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    if (optedOut) {
      const booking2: Booking = {
        id: newId(),
        sessionId: target.id,
        memberId: optedOut.id,
        status: "booked",
        bookedAt: new Date(NOW.getTime() - 86400000).toISOString(),
        cancelledAt: null,
      };
      await repos.bookings.insert(booking2);
    }

    const summary = await runReminders(repos, {
      now: () => NOW.toISOString(),
    });

    expect(summary.queued).toBeGreaterThan(0);
    expect(summary.queued + summary.skipped).toBeGreaterThan(0);
  });
});
