import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportGet } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingRows } from "@/lib/services/booking-list";
import { HttpError } from "@/lib/http";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Control the session guard without touching next/headers cookies, which
// aren't available in the plain-Node vitest environment.
const { requireSession } = vi.hoisted(() => ({ requireSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
  SESSION_COOKIE: "sb-session",
}));

// A focused seed with one comma-in-name member so the route exercises RFC 4180
// quoting end to end. Timestamps are pinned relative to NOW for boundary tests.
const STARTS_AT = "2026-06-01T09:00:00.000Z";
function commaNameSeed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW.toISOString() },
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
        name: "Rossi, Chiara",
        email: "chiara@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: NOW.toISOString(),
      },
    ],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Reformer Pilates",
        description: null,
        color: "#3f6f9f",
        defaultCapacity: 8,
        defaultPriceCents: 2600,
        createdAt: NOW.toISOString(),
      },
    ],
    sessions: [
      {
        id: "cs1",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "Noor",
        startsAt: STARTS_AT,
        endsAt: "2026-06-01T10:00:00.000Z",
        capacity: 8,
        priceCents: 2600,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
    ],
    bookings: [
      {
        id: "b1",
        sessionId: "cs1",
        memberId: "m1",
        status: "booked",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("GET /api/export", () => {
  afterEach(() => {
    __setTestRepositories(null);
    requireSession.mockReset();
  });

  it("returns 401 without a signed-in session", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    requireSession.mockRejectedValue(new HttpError(401, "unauthorized", "Sign in required"));
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });

  describe("type=bookings", () => {
    beforeEach(() => {
      requireSession.mockResolvedValue({ email: "bookkeeper@riverbank.test" });
    });

    it("emits the Starts,Class,Member,Email,Status header and a CSV body", async () => {
      __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
      const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
      const csv = await res.text();
      const lines = csv.split("\r\n");
      expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
      expect(lines.length).toBeGreaterThan(1);
    });

    it("quotes a member name containing a comma so it stays one field", async () => {
      __setTestRepositories(createInMemoryRepositories(commaNameSeed()));
      const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
      expect(res.status).toBe(200);
      const csv = await res.text();
      const [, row] = csv.split("\r\n");
      expect(row).toBe(
        '2026-06-01T09:00:00.000Z,Reformer Pilates,"Rossi, Chiara",chiara@example.com,booked',
      );
    });

    it("includes a booking whose session starts exactly at `from` and at `to` (inclusive)", async () => {
      __setTestRepositories(createInMemoryRepositories(commaNameSeed()));
      // from == to == the session start: both inclusive bounds must keep the row.
      const url = `http://localhost/api/export?type=bookings&from=${STARTS_AT}&to=${STARTS_AT}`;
      const res = await exportGet(new NextRequest(url));
      expect(res.status).toBe(200);
      const csv = await res.text();
      const lines = csv.split("\r\n");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"Rossi, Chiara"');
    });

    it("excludes bookings outside the [from, to] window", async () => {
      __setTestRepositories(createInMemoryRepositories(commaNameSeed()));
      // A window entirely after the session should yield only the header.
      const after = "2026-07-01T00:00:00.000Z";
      const url = `http://localhost/api/export?type=bookings&from=${after}&to=${after}`;
      const res = await exportGet(new NextRequest(url));
      expect(res.status).toBe(200);
      const csv = await res.text();
      const lines = csv.split("\r\n");
      expect(lines).toEqual(["Starts,Class,Member,Email,Status"]);
    });

    it("respects an inclusive upper bound against the shared (exclusive) range semantics", async () => {
      // The shared SessionRange.to is exclusive; the export must override that
      // and include a session starting exactly at `to`. Verify by fetching the
      // full list, picking a real startsAt, and using it as `to`.
      const repos = createInMemoryRepositories(buildSeed(NOW));
      const studio = await repos.studios.getFirst();
      const studioId = studio?.id ?? "";
      const rows = await listBookingRows(repos, studioId, {});
      expect(rows.length).toBeGreaterThan(0);
      const target = rows[0].startsAt;
      __setTestRepositories(repos);
      const url = `http://localhost/api/export?type=bookings&from=${target}&to=${target}`;
      const res = await exportGet(new NextRequest(url));
      expect(res.status).toBe(200);
      const csv = await res.text();
      // At least one data row whose Starts column equals the bound.
      const dataRows = csv.split("\r\n").slice(1);
      expect(dataRows.some((row) => row.startsWith(`${target},`))).toBe(true);
    });
  });
});
