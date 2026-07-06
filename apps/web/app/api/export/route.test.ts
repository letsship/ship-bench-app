import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));

import { GET as exportGet } from "@/app/api/export/route";
import { requireSession } from "@/lib/auth/session";
import { newId } from "@/lib/db/ids";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { HttpError } from "@/lib/http";

function buildSeed(): SeedData {
  const studioId = newId();
  const classTypeId = newId();
  const memberId = newId();

  const sessionInRange = { id: newId(), startsAt: "2026-06-15T09:00:00.000Z" };
  const sessionOutOfRange = { id: newId(), startsAt: "2026-07-15T09:00:00.000Z" };

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
    sessions: [sessionInRange, sessionOutOfRange].map((session) => ({
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
    })),
    bookings: [sessionInRange, sessionOutOfRange].map((session) => ({
      id: newId(),
      sessionId: session.id,
      memberId,
      status: "booked",
      bookedAt: "2026-01-01T00:00:00.000Z",
      cancelledAt: null,
    })),
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("GET /api/export?type=bookings", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.mocked(requireSession).mockReset();
  });

  it("requires a signed-in session", async () => {
    vi.mocked(requireSession).mockRejectedValue(
      new HttpError(401, "unauthorized", "Sign in required"),
    );
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });

  it("returns a bookings CSV with the required columns, quoting a comma-containing name", async () => {
    vi.mocked(requireSession).mockResolvedValue({ email: "owner@example.com" });
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    const [header, ...rows] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows).toHaveLength(2);
    expect(rows.join("\n")).toContain('"Rossi, Chiara"');
  });

  it("filters bookings to sessions starting within [from, to], inclusive", async () => {
    vi.mocked(requireSession).mockResolvedValue({ email: "owner@example.com" });
    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-06-15T09:00:00.000Z&to=2026-06-15T09:00:00.000Z",
      ),
    );
    const body = await res.text();
    const [, ...rows] = body.split("\r\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("2026-06-15T09:00:00.000Z");
  });
});
