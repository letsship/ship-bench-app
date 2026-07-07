import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { listBookingsForExport } from "./booking-list";

function makeSeed(): SeedData {
  const studio = {
    id: "studio-1",
    name: "Test Studio",
    slug: "test",
    timezone: "UTC",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const settings = {
    studioId: "studio-1",
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
    id: "member-1",
    studioId: "studio-1",
    name: "Rossi, Chiara",
    email: "chiara@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const classType = {
    id: "type-1",
    studioId: "studio-1",
    name: "Vinyasa Flow",
    description: "A flow class",
    color: "#5b8c5a",
    defaultCapacity: 10,
    defaultPriceCents: 1800,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const sessions = [
    {
      id: "session-1",
      studioId: "studio-1",
      classTypeId: "type-1",
      instructor: "Noor",
      startsAt: "2026-06-01T08:00:00.000Z",
      endsAt: "2026-06-01T09:00:00.000Z",
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "session-2",
      studioId: "studio-1",
      classTypeId: "type-1",
      instructor: "Noor",
      startsAt: "2026-06-01T12:00:00.000Z",
      endsAt: "2026-06-01T13:00:00.000Z",
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "session-3",
      studioId: "studio-1",
      classTypeId: "type-1",
      instructor: "Noor",
      startsAt: "2026-06-01T17:00:00.000Z",
      endsAt: "2026-06-01T18:00:00.000Z",
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const bookings = [
    {
      id: "booking-1",
      sessionId: "session-1",
      memberId: "member-1",
      status: "booked",
      bookedAt: "2026-01-01T00:00:00.000Z",
      cancelledAt: null,
    },
    {
      id: "booking-2",
      sessionId: "session-2",
      memberId: "member-1",
      status: "attended",
      bookedAt: "2026-01-01T00:00:00.000Z",
      cancelledAt: null,
    },
    {
      id: "booking-3",
      sessionId: "session-3",
      memberId: "member-1",
      status: "no_show",
      bookedAt: "2026-01-01T00:00:00.000Z",
      cancelledAt: null,
    },
  ];
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
  it("includes a session starting exactly at from", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1", {
      from: "2026-06-01T08:00:00.000Z",
      to: "2026-06-01T17:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toContain("2026-06-01T08:00:00.000Z");
  });

  it("includes a session starting exactly at to", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1", {
      from: "2026-06-01T08:00:00.000Z",
      to: "2026-06-01T17:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toContain("2026-06-01T17:00:00.000Z");
  });

  it("excludes a session starting before from", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1", {
      from: "2026-06-01T12:00:00.000Z",
      to: "2026-06-01T17:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).not.toContain("2026-06-01T08:00:00.000Z");
  });

  it("excludes a session starting after to", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1", {
      from: "2026-06-01T08:00:00.000Z",
      to: "2026-06-01T12:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).not.toContain("2026-06-01T17:00:00.000Z");
  });

  it("is unbounded below when from is omitted", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1", {
      to: "2026-06-01T12:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toContain("2026-06-01T08:00:00.000Z");
  });

  it("is unbounded above when to is omitted", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1", {
      from: "2026-06-01T12:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toContain("2026-06-01T17:00:00.000Z");
  });

  it("includes email in rows", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1");
    expect(rows[0].email).toBe("chiara@example.com");
  });

  it("sorts results by startsAt", async () => {
    const repos = createInMemoryRepositories(makeSeed());
    const rows = await listBookingsForExport(repos, "studio-1");
    const startsAts = rows.map((r) => r.startsAt);
    expect(startsAts).toEqual([...startsAts].sort());
  });
});
