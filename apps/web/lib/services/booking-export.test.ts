import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { listBookingsForExport } from "./booking-export";

const STUDIO_ID = "studio-1";

const STUDIO: SeedData["studio"] = {
  id: STUDIO_ID,
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SETTINGS: SeedData["settings"] = {
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

const MEMBER = {
  id: "member-1",
  studioId: STUDIO_ID,
  name: "Chiara Rossi",
  email: "chiara@example.com",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const CLASS_TYPE = {
  id: "class-1",
  studioId: STUDIO_ID,
  name: "Vinyasa Flow",
  description: null,
  color: "#5b8c5a",
  defaultCapacity: 16,
  defaultPriceCents: 1800,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function session(id: string, startsAt: string) {
  return {
    id,
    studioId: STUDIO_ID,
    classTypeId: CLASS_TYPE.id,
    instructor: "Noor",
    startsAt,
    endsAt: startsAt,
    capacity: 16,
    priceCents: 1800,
    status: "scheduled",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function booking(id: string, sessionId: string, status = "booked") {
  return {
    id,
    sessionId,
    memberId: MEMBER.id,
    status,
    bookedAt: "2026-01-01T00:00:00.000Z",
    cancelledAt: null,
  };
}

const SESSIONS = [
  session("session-before", "2026-05-31T23:00:00.000Z"),
  session("session-from", "2026-06-01T00:00:00.000Z"),
  session("session-middle", "2026-06-15T09:00:00.000Z"),
  session("session-to", "2026-06-30T23:59:59.000Z"),
  session("session-after", "2026-07-01T00:00:00.000Z"),
];

const BOOKINGS = SESSIONS.map((s, index) => booking(`booking-${index}`, s.id));

function buildRepos(): Repositories {
  const seed: SeedData = {
    studio: STUDIO,
    settings: SETTINGS,
    members: [MEMBER],
    classTypes: [CLASS_TYPE],
    sessions: SESSIONS,
    bookings: BOOKINGS,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
  return createInMemoryRepositories(seed);
}

describe("listBookingsForExport", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = buildRepos();
  });

  it("is unbounded when no range is given", async () => {
    const rows = await listBookingsForExport(repos, STUDIO_ID);
    expect(rows).toHaveLength(SESSIONS.length);
  });

  it("includes a booking whose session starts exactly at `from`", async () => {
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      from: "2026-06-01T00:00:00.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toContain("2026-06-01T00:00:00.000Z");
    expect(rows.map((r) => r.startsAt)).not.toContain("2026-05-31T23:00:00.000Z");
  });

  it("includes a booking whose session starts exactly at `to` (inclusive upper bound)", async () => {
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      to: "2026-06-30T23:59:59.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toContain("2026-06-30T23:59:59.000Z");
    expect(rows.map((r) => r.startsAt)).not.toContain("2026-07-01T00:00:00.000Z");
  });

  it("filters to a closed [from, to] window", async () => {
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.000Z",
    });
    expect(rows.map((r) => r.startsAt)).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-06-15T09:00:00.000Z",
      "2026-06-30T23:59:59.000Z",
    ]);
  });

  it("includes exact-boundary matches even when the stored timestamp and the query bound use different ISO offset notations", async () => {
    // D1 stores startsAt in offset form ("+00:00"); callers may pass "Z".
    // A naive string compare never treats these as equal at the boundary.
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      from: "2026-06-01T00:00:00Z",
      to: "2026-06-01T00:00:00+00:00",
    });
    expect(rows.map((r) => r.startsAt)).toEqual(["2026-06-01T00:00:00.000Z"]);
  });

  it("carries the joined member email alongside the name", async () => {
    const rows = await listBookingsForExport(repos, STUDIO_ID, {
      from: "2026-06-15T09:00:00.000Z",
      to: "2026-06-15T09:00:00.000Z",
    });
    expect(rows).toEqual([
      {
        startsAt: "2026-06-15T09:00:00.000Z",
        className: "Vinyasa Flow",
        memberName: "Chiara Rossi",
        memberEmail: "chiara@example.com",
        status: "booked",
      },
    ]);
  });
});
