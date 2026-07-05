import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { listBookingsForExport } from "./booking-export";

const STUDIO_ID = "s1";

function seed(): SeedData {
  const studio = {
    id: STUDIO_ID,
    name: "S",
    slug: "s",
    timezone: "Europe/Amsterdam",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const settings = {
    studioId: STUDIO_ID,
    currency: "EUR",
    taxRateBps: 900,
    cancellationWindowHours: 12,
    waitlistEnabled: true,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  };
  const member = {
    id: "m1",
    studioId: STUDIO_ID,
    name: "Chiara Rossi",
    email: "chiara@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const classType = {
    id: "c1",
    studioId: STUDIO_ID,
    name: "Vinyasa Flow",
    description: null,
    color: "#000000",
    defaultCapacity: 10,
    defaultPriceCents: 1500,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const sessions = [
    {
      id: "sess-before",
      studioId: STUDIO_ID,
      classTypeId: classType.id,
      instructor: "Ana",
      startsAt: "2026-05-31T09:00:00.000Z",
      endsAt: "2026-05-31T10:00:00.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sess-from",
      studioId: STUDIO_ID,
      classTypeId: classType.id,
      instructor: "Ana",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-01T01:00:00.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sess-mid",
      studioId: STUDIO_ID,
      classTypeId: classType.id,
      instructor: "Ana",
      startsAt: "2026-06-15T09:00:00.000Z",
      endsAt: "2026-06-15T10:00:00.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sess-to",
      studioId: STUDIO_ID,
      classTypeId: classType.id,
      instructor: "Ana",
      startsAt: "2026-06-30T23:59:59.000Z",
      endsAt: "2026-07-01T00:59:59.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sess-after",
      studioId: STUDIO_ID,
      classTypeId: classType.id,
      instructor: "Ana",
      startsAt: "2026-07-01T09:00:00.000Z",
      endsAt: "2026-07-01T10:00:00.000Z",
      capacity: 10,
      priceCents: 1500,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const bookings = sessions.map((session) => ({
    id: `booking-${session.id}`,
    sessionId: session.id,
    memberId: member.id,
    status: "booked",
    bookedAt: "2026-01-01T00:00:00.000Z",
    cancelledAt: null,
  }));

  return {
    studio,
    settings,
    members: [member],
    classTypes: [classType],
    sessions,
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("listBookingsForExport", () => {
  it("is unbounded when neither from nor to is given", async () => {
    const repos = createInMemoryRepositories(seed());
    const rows = await listBookingsForExport(repos, STUDIO_ID, {});
    expect(rows.map((row) => row.id).sort()).toEqual(
      [
        "booking-sess-before",
        "booking-sess-from",
        "booking-sess-mid",
        "booking-sess-to",
        "booking-sess-after",
      ].sort(),
    );
  });

  it("includes a session starting exactly at the from bound (inclusive)", async () => {
    const repos = createInMemoryRepositories(seed());
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      from: "2026-06-01T00:00:00.000Z",
    });
    expect(rows.some((row) => row.id === "booking-sess-from")).toBe(true);
    expect(rows.some((row) => row.id === "booking-sess-before")).toBe(false);
  });

  it("includes a session starting exactly at the to bound (inclusive)", async () => {
    const repos = createInMemoryRepositories(seed());
    const rows = await listBookingsForExport(repos, STUDIO_ID, { to: "2026-06-30T23:59:59.000Z" });
    expect(rows.some((row) => row.id === "booking-sess-to")).toBe(true);
    expect(rows.some((row) => row.id === "booking-sess-after")).toBe(false);
  });

  it("applies both bounds together and is unbounded on the omitted side", async () => {
    const repos = createInMemoryRepositories(seed());
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.000Z",
    });
    expect(rows.map((row) => row.id).sort()).toEqual(
      ["booking-sess-from", "booking-sess-mid", "booking-sess-to"].sort(),
    );
  });

  it("carries the member's email on each row", async () => {
    const repos = createInMemoryRepositories(seed());
    const rows = await listBookingsForExport(repos, STUDIO_ID, {});
    expect(rows[0].email).toBe("chiara@example.com");
  });
});
