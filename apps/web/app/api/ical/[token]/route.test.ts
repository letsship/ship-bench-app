import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, Member } from "@/lib/db/types";

// The route compares against the real clock (`new Date()`), so fixtures are
// anchored to it: genuinely future and past sessions.
const NOW = new Date();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: `Member ${id}`,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  calendarToken: `caltok-${id}`,
  createdAt: PAST,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: PAST,
  ...over,
});

const booking = (id: string, sessionId: string, memberId: string, status = "booked"): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: PAST,
  cancelledAt: null,
});

function seed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: PAST },
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
    members: [member("m1"), member("m2")],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa Flow",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: PAST,
      },
    ],
    sessions: [
      session("cs-past", { startsAt: PAST, endsAt: PAST_END }),
      session("cs-up1"),
      session("cs-up2"),
      session("cs-wait"),
      session("cs-cxl"),
    ],
    bookings: [
      booking("b1", "cs-past", "m1", "attended"),
      booking("b2", "cs-up1", "m1"),
      booking("b3", "cs-up2", "m2"),
      booking("b4", "cs-wait", "m1", "waitlisted"),
      booking("b5", "cs-cxl", "m1", "cancelled"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

const request = (token: string): NextRequest =>
  new NextRequest(`http://localhost/api/ical/${encodeURIComponent(token)}`);

const context = (token: string): { params: Promise<{ token: string }> } => ({
  params: Promise.resolve({ token }),
});

describe("GET /api/ical/[token]", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(seed()));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a text/calendar feed of the member's upcoming booked sessions", async () => {
    const res = await GET(request("caltok-m1"), context("caltok-m1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("UID:cs-up1@studiobook");
    expect(body).toContain("SUMMARY:Vinyasa Flow");
  });

  it("excludes other members' sessions and past/waitlisted/cancelled bookings", async () => {
    const res = await GET(request("caltok-m1"), context("caltok-m1"));
    const body = await res.text();
    expect(body).not.toContain("cs-up2@studiobook"); // only m2 is booked there
    expect(body).not.toContain("cs-past@studiobook");
    expect(body).not.toContain("cs-wait@studiobook");
    expect(body).not.toContain("cs-cxl@studiobook");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await GET(request("not-a-real-token"), context("not-a-real-token"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("returns 404 for a blank token", async () => {
    const res = await GET(request(" "), context(" "));
    expect(res.status).toBe(404);
  });

  it("authorizes with the token alone — no session cookie on the request", async () => {
    const req = request("caltok-m2");
    expect(req.headers.get("cookie")).toBeNull();
    const res = await GET(req, context("caltok-m2"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("UID:cs-up2@studiobook");
  });
});
