import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireSession: async () => ({ email: "operator@example.com" }),
  };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");
const BOOKING_EXPORT_TO = "2026-06-30T09:00:00.000Z";

function bookingExportSeed(): SeedData {
  const seed = buildSeed(NOW);
  const studioId = seed.studio.id;
  const classType = {
    ...seed.classTypes[0],
    id: "ct-booking-export",
    studioId,
    name: "Vinyasa Flow",
  };
  const member = {
    ...seed.members[0],
    id: "m-booking-export",
    studioId,
    name: "Rossi, Chiara",
    email: "chiara@example.com",
  };
  const atToSession = {
    ...seed.sessions[0],
    id: "session-at-to",
    studioId,
    classTypeId: classType.id,
    startsAt: BOOKING_EXPORT_TO,
    endsAt: "2026-06-30T10:00:00.000Z",
  };
  const afterToSession = {
    ...seed.sessions[1],
    id: "session-after-to",
    studioId,
    classTypeId: classType.id,
    startsAt: "2026-06-30T09:00:00.001Z",
    endsAt: "2026-06-30T10:00:00.001Z",
  };

  return {
    ...seed,
    members: [member],
    classTypes: [classType],
    sessions: [atToSession, afterToSession],
    bookings: [
      {
        id: "booking-at-to",
        sessionId: atToSession.id,
        memberId: member.id,
        status: "attended",
        bookedAt: "2026-06-01T09:00:00.000Z",
        cancelledAt: null,
      },
      {
        id: "booking-after-to",
        sessionId: afterToSession.id,
        memberId: member.id,
        status: "booked",
        bookedAt: "2026-06-01T09:00:00.000Z",
        cancelledAt: null,
      },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/export?type=bookings returns the booking CSV header", async () => {
    __setTestRepositories(createInMemoryRepositories(bookingExportSeed()));
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect((await res.text()).split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings includes the inclusive to boundary", async () => {
    __setTestRepositories(createInMemoryRepositories(bookingExportSeed()));
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&to=${BOOKING_EXPORT_TO}`),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain(`${BOOKING_EXPORT_TO},Vinyasa Flow,"Rossi, Chiara",chiara@example.com,attended`);
  });

  it("GET /api/export?type=bookings excludes sessions after the to boundary", async () => {
    __setTestRepositories(createInMemoryRepositories(bookingExportSeed()));
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&to=${BOOKING_EXPORT_TO}`),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("2026-06-30T09:00:00.001Z");
  });
});
