import { describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { publicRosterQuerySchema } from "@/lib/validation";
import { listPublicRoster } from "./public-roster";

const NOW = new Date();
const ISO = NOW.toISOString();
const START = new Date(NOW.getTime() + 86_400_000).toISOString();
const END = new Date(NOW.getTime() + 86_400_000 + 3_600_000).toISOString();

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
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "Ada",
        email: "ada@example.com",
        phone: "+31600000000",
        status: "active",
        notificationsOptedOut: false,
        createdAt: ISO,
      },
    ],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa",
        description: null,
        color: "#8a3324",
        defaultCapacity: 10,
        defaultPriceCents: 1800,
        createdAt: ISO,
      },
    ],
    sessions: [
      {
        id: "sess1",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "Iris",
        startsAt: START,
        endsAt: END,
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: ISO,
      },
    ],
    bookings: [
      {
        id: "b1",
        sessionId: "sess1",
        memberId: "m1",
        status: "booked",
        bookedAt: ISO,
        cancelledAt: null,
      },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("listPublicRoster", () => {
  it("returns the class with its title, instructor and remaining seats", async () => {
    const repos = createInMemoryRepositories(seed());

    const roster = await listPublicRoster(repos, "s1");

    expect(roster).toHaveLength(1);
    expect(roster[0].title).toBe("Vinyasa");
    expect(roster[0].instructor).toBe("Iris");
    expect(roster[0].seatsAvailable).toBe(9);
  });

  it("narrows to the requested sessions", async () => {
    const repos = createInMemoryRepositories(seed());

    const roster = await listPublicRoster(repos, "s1", ["sess1"]);

    expect(roster).toHaveLength(1);
    expect(roster[0].attendees).toHaveLength(1);
  });

  it("omits a cancelled session", async () => {
    const base = seed();
    const repos = createInMemoryRepositories({
      ...base,
      sessions: [{ ...base.sessions[0], status: "cancelled" }],
    });

    const roster = await listPublicRoster(repos, "s1");

    expect(roster).toEqual([]);
  });

  it("exposes no member name, email or phone on an attendee", async () => {
    const repos = createInMemoryRepositories(seed());

    const roster = await listPublicRoster(repos, "s1");

    const serialised = JSON.stringify(roster);
    expect(serialised).not.toContain("Ada");
    expect(serialised).not.toContain("ada@example.com");
    expect(serialised).not.toContain("+31600000000");
    expect(roster[0].attendees).toEqual([{ initials: "A" }]);
  });

  it("gives an attendee only the fields the response type declares", async () => {
    const base = seed();
    // Stands in for a future `bookings` column: present on the row the service
    // reads, and still not allowed to reach an unauthenticated response.
    const bookingWithFutureColumn = { ...base.bookings[0], internalNote: "owes for last month" };
    const repos = createInMemoryRepositories({
      ...base,
      bookings: [bookingWithFutureColumn],
    });

    const roster = await listPublicRoster(repos, "s1");

    expect(Object.keys(roster[0].attendees[0])).toEqual(["initials"]);
    expect(JSON.stringify(roster)).not.toContain("owes for last month");
  });

  it("returns no bookings for a session belonging to another studio", async () => {
    const base = seed();
    const repos = createInMemoryRepositories({
      ...base,
      sessions: [...base.sessions, { ...base.sessions[0], id: "other-sess", studioId: "s2" }],
      bookings: [...base.bookings, { ...base.bookings[0], id: "b2", sessionId: "other-sess" }],
    });

    const roster = await listPublicRoster(repos, "s1", ["other-sess"]);

    expect(roster).toEqual([]);
  });

  it("narrowing drops the studio's own sessions that were not requested", async () => {
    const base = seed();
    const repos = createInMemoryRepositories({
      ...base,
      sessions: [...base.sessions, { ...base.sessions[0], id: "sess2" }],
    });

    const roster = await listPublicRoster(repos, "s1", ["sess2"]);

    expect(roster).toHaveLength(1);
    expect(roster[0].attendees).toEqual([]);
  });

  it("caps the sessions one public request reads", async () => {
    const base = seed();
    const repos = createInMemoryRepositories({
      ...base,
      sessions: Array.from({ length: 250 }, (_, i) => ({
        ...base.sessions[0],
        id: `sess${i}`,
        startsAt: new Date(NOW.getTime() + i * 3_600_000).toISOString(),
      })),
    });

    const roster = await listPublicRoster(repos, "s1");

    expect(roster).toHaveLength(200);
  });
});

describe("publicRosterQuerySchema", () => {
  it("parses a comma-separated list and ignores blank entries", () => {
    expect(publicRosterQuerySchema.parse({ sessionIds: "a, b,,c" }).sessionIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("allows an absent parameter", () => {
    expect(publicRosterQuerySchema.parse({}).sessionIds).toBeUndefined();
  });

  it("rejects an oversized id list", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `s${i}`).join(",");

    expect(() => publicRosterQuerySchema.parse({ sessionIds: tooMany })).toThrow();
  });

  it("rejects an over-long id", () => {
    expect(() => publicRosterQuerySchema.parse({ sessionIds: "x".repeat(65) })).toThrow();
  });
});
