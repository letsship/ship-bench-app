import { describe, expect, it } from "vitest";
import type { Booking, ClassSession, ClassType } from "@/lib/db/types";
import { computeOccupancy } from "@/lib/domain/capacity";
import {
  isCancelled,
  publicScheduleWindow,
  toPublicClass,
  type PublicClass,
} from "./public-schedule";

const NOW = new Date("2026-05-20T09:00:00Z");
const ISO_NOW = NOW.toISOString();

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Yoga",
  description: "Yoga class",
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO_NOW,
};

const baseSession = (id: string, startsAt: string, endsAt: string): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: classType.id,
  instructor: "Alice",
  startsAt,
  endsAt,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO_NOW,
});

describe("publicScheduleWindow", () => {
  it("returns a 14-day window from now (inclusive) to now + 14 days (exclusive)", () => {
    const window = publicScheduleWindow(NOW);
    expect(window.from).toBe(ISO_NOW);
    const expectedTo = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(window.to).toBe(expectedTo);
  });
});

describe("isCancelled", () => {
  it("returns true for a cancelled session", () => {
    const session = baseSession("s1", ISO_NOW, ISO_NOW);
    session.status = "cancelled";
    expect(isCancelled(session)).toBe(true);
  });

  it("returns false for a scheduled session", () => {
    const session = baseSession("s1", ISO_NOW, ISO_NOW);
    expect(isCancelled(session)).toBe(false);
  });
});

describe("toPublicClass", () => {
  it("maps session to PublicClass with only public fields", () => {
    const startsAt = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    const endsAt = new Date(NOW.getTime() + 90 * 60 * 1000).toISOString(); // 1.5 hours from now
    const session = baseSession("s1", startsAt, endsAt);
    const occupancy = computeOccupancy(10, []);

    const publicClass = toPublicClass(session, classType, occupancy);

    expect(publicClass).toEqual({
      title: "Yoga",
      startsAt,
      durationMinutes: 30,
      instructor: "Alice",
      seatsAvailable: 10,
    });
  });

  it("computes durationMinutes correctly from startsAt and endsAt", () => {
    const startsAt = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    const endsAt = new Date(NOW.getTime() + 120 * 60 * 1000).toISOString(); // 2 hours total
    const session = baseSession("s1", startsAt, endsAt);
    const occupancy = computeOccupancy(10, []);

    const publicClass = toPublicClass(session, classType, occupancy);
    expect(publicClass.durationMinutes).toBe(60);
  });

  it("computes seatsAvailable from occupancy", () => {
    const session = baseSession(
      "s1",
      new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
      new Date(NOW.getTime() + 90 * 60 * 1000).toISOString(),
    );

    // 3 bookings out of 10 capacity -> 7 seats available
    const bookings: Booking[] = [
      {
        id: "b1",
        sessionId: "s1",
        memberId: "m1",
        status: "booked",
        bookedAt: ISO_NOW,
        cancelledAt: null,
      },
      {
        id: "b2",
        sessionId: "s1",
        memberId: "m2",
        status: "booked",
        bookedAt: ISO_NOW,
        cancelledAt: null,
      },
      {
        id: "b3",
        sessionId: "s1",
        memberId: "m3",
        status: "booked",
        bookedAt: ISO_NOW,
        cancelledAt: null,
      },
    ];
    const occupancy = computeOccupancy(10, bookings);

    const publicClass = toPublicClass(session, classType, occupancy);
    expect(publicClass.seatsAvailable).toBe(7);
  });

  it("excludes member names, emails, and booking/invoice data from the DTO", () => {
    const session = baseSession(
      "s1",
      new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
      new Date(NOW.getTime() + 90 * 60 * 1000).toISOString(),
    );
    const occupancy = computeOccupancy(10, []);

    const publicClass = toPublicClass(session, classType, occupancy);

    // The DTO has exactly these five fields and no others.
    const keys = Object.keys(publicClass) as (keyof PublicClass)[];
    expect(keys.sort()).toEqual(
      ["durationMinutes", "instructor", "seatsAvailable", "startsAt", "title"].sort(),
    );

    // Explicitly assert no sensitive fields.
    expect(publicClass).not.toHaveProperty("memberId");
    expect(publicClass).not.toHaveProperty("memberName");
    expect(publicClass).not.toHaveProperty("memberEmail");
    expect(publicClass).not.toHaveProperty("bookings");
    expect(publicClass).not.toHaveProperty("invoices");
    expect(publicClass).not.toHaveProperty("priceCents");
  });
});
