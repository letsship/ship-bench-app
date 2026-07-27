import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock } = vi.hoisted(() => ({ requireSessionMock: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireSession: () => requireSessionMock(),
}));

import { GET } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { HttpError } from "@/lib/http";

const ISO = "2026-01-01T00:00:00.000Z";

function baseSeed(over: Partial<SeedData> = {}): SeedData {
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
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, name: string): Member => ({
  id,
  studioId: "s1",
  name,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
});

const classType = (id: string, name: string): ClassType => ({
  id,
  studioId: "s1",
  name,
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, startsAt: string): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: startsAt,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
});

const booking = (id: string, sessionId: string, memberId: string): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
});

const SEED = baseSeed({
  members: [member("m1", "Amara"), member("m2", "Rossi, Chiara")],
  classTypes: [classType("ct1", "Vinyasa Flow")],
  sessions: [
    session("cs1", "2026-06-01T09:00:00.000Z"),
    session("cs2", "2026-06-15T09:00:00.000Z"),
    session("cs3", "2026-06-30T09:00:00.000Z"),
  ],
  bookings: [booking("b1", "cs1", "m1"), booking("b2", "cs2", "m2"), booking("b3", "cs3", "m1")],
});

describe("GET /api/export", () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    requireSessionMock.mockResolvedValue({ email: "operator@riverbank.studio" });
    __setTestRepositories(createInMemoryRepositories(SEED));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("requires a signed-in session", async () => {
    requireSessionMock.mockRejectedValue(new HttpError(401, "unauthorized", "Sign in required"));
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });

  it("returns a bookings CSV with the expected header and rows", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain('filename="studiobook-bookings.csv"');

    const [header, ...rows] = (await res.text()).split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe('2026-06-15T09:00:00.000Z,Vinyasa Flow,"Rossi, Chiara",m2@e.co,booked');
  });

  it("filters bookings inclusively by from/to session start", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-06-01T09:00:00.000Z&to=2026-06-15T09:00:00.000Z",
      ),
    );
    const [, ...rows] = (await res.text()).split("\r\n");
    expect(rows).toHaveLength(2);
  });

  it("still rejects an unknown export type", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=unknown"));
    expect(res.status).toBe(400);
  });
});
