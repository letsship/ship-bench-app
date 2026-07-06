import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { newId } from "@/lib/db/ids";
import { listBookingsForExport } from "./booking-export";

function buildSeed(): SeedData {
  const studioId = newId();
  const classTypeId = newId();
  const memberId = newId();

  const sessionEarly = { id: newId(), startsAt: "2026-05-31T23:00:00.000Z" };
  const sessionAtFrom = { id: newId(), startsAt: "2026-06-01T00:00:00.000Z" };
  const sessionMiddle = { id: newId(), startsAt: "2026-06-15T09:00:00.000Z" };
  const sessionAtTo = { id: newId(), startsAt: "2026-06-30T23:59:59.000Z" };
  const sessionLate = { id: newId(), startsAt: "2026-07-01T00:00:00.000Z" };

  return {
    studio: {
      id: studioId,
      name: "Studio",
      slug: "studio",
      timezone: "UTC",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    settings: {
      studioId,
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 24,
      waitlistEnabled: false,
      notifyBookingConfirmations: false,
      notifyCancellations: false,
      notifyWaitlistPromotions: false,
      notifyInvoices: false,
    },
    members: [
      {
        id: memberId,
        studioId,
        name: "Rossi, Chiara",
        email: "chiara@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    classTypes: [
      {
        id: classTypeId,
        studioId,
        name: "Vinyasa Flow",
        description: null,
        color: "#5b8c5a",
        defaultCapacity: 16,
        defaultPriceCents: 1800,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    sessions: [sessionEarly, sessionAtFrom, sessionMiddle, sessionAtTo, sessionLate].map(
      (session) => ({
        id: session.id,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: session.startsAt,
        endsAt: session.startsAt,
        capacity: 16,
        priceCents: 1800,
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ),
    bookings: [sessionEarly, sessionAtFrom, sessionMiddle, sessionAtTo, sessionLate].map(
      (session) => ({
        id: newId(),
        sessionId: session.id,
        memberId,
        status: "booked",
        bookedAt: "2026-01-01T00:00:00.000Z",
        cancelledAt: null,
      }),
    ),
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("listBookingsForExport", () => {
  it("is unbounded when no range is given", async () => {
    const seed = buildSeed();
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingsForExport(repos, seed.studio.id, {});
    expect(rows).toHaveLength(5);
  });

  it("includes sessions starting exactly at `from` and `to` (inclusive both ends)", async () => {
    const seed = buildSeed();
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingsForExport(repos, seed.studio.id, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.000Z",
    });
    const starts = rows.map((row) => row.startsAt).sort();
    expect(starts).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-06-15T09:00:00.000Z",
      "2026-06-30T23:59:59.000Z",
    ]);
  });

  it("is unbounded below when `from` is omitted", async () => {
    const seed = buildSeed();
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingsForExport(repos, seed.studio.id, {
      to: "2026-06-01T00:00:00.000Z",
    });
    const starts = rows.map((row) => row.startsAt).sort();
    expect(starts).toEqual(["2026-05-31T23:00:00.000Z", "2026-06-01T00:00:00.000Z"]);
  });

  it("is unbounded above when `to` is omitted", async () => {
    const seed = buildSeed();
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingsForExport(repos, seed.studio.id, {
      from: "2026-06-30T23:59:59.000Z",
    });
    const starts = rows.map((row) => row.startsAt).sort();
    expect(starts).toEqual(["2026-06-30T23:59:59.000Z", "2026-07-01T00:00:00.000Z"]);
  });

  it("includes a session whose stored startsAt uses a +00:00 offset when it matches an exact Z-suffixed `from`", async () => {
    // Supabase serializes timestamptz as e.g. "2026-06-27T08:00:00+00:00" while
    // query params/CSV output use "Z". A naive string comparison treats
    // "+00:00" as lexicographically less than "Z", wrongly excluding sessions
    // that start exactly at `from`. Compare as actual instants instead.
    const seed = buildSeed();
    const offsetSessionId = newId();
    seed.sessions.push({
      id: offsetSessionId,
      studioId: seed.studio.id,
      classTypeId: seed.classTypes[0].id,
      instructor: "Noor",
      startsAt: "2026-06-27T08:00:00+00:00",
      endsAt: "2026-06-27T08:00:00+00:00",
      capacity: 16,
      priceCents: 1800,
      status: "scheduled",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    seed.bookings.push({
      id: newId(),
      sessionId: offsetSessionId,
      memberId: seed.members[0].id,
      status: "booked",
      bookedAt: "2026-01-01T00:00:00.000Z",
      cancelledAt: null,
    });
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingsForExport(repos, seed.studio.id, {
      from: "2026-06-27T08:00:00.000Z",
      to: "2026-06-27T08:00:00.000Z",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].startsAt).toBe("2026-06-27T08:00:00+00:00");
  });

  it("includes the member's email alongside the existing joined fields", async () => {
    const seed = buildSeed();
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingsForExport(repos, seed.studio.id, {
      from: "2026-06-15T09:00:00.000Z",
      to: "2026-06-15T09:00:00.000Z",
    });
    expect(rows).toEqual([
      {
        startsAt: "2026-06-15T09:00:00.000Z",
        className: "Vinyasa Flow",
        memberName: "Rossi, Chiara",
        memberEmail: "chiara@example.com",
        status: "booked",
      },
    ]);
  });
});
