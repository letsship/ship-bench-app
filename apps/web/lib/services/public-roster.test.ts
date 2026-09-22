import { describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
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
});
