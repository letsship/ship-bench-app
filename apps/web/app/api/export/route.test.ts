import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { __setTestRepositories } from "@/lib/db/repos";
import { SEED_NOW, buildSeed } from "@/lib/db/seed-data";
import { createSessionToken } from "@/lib/auth/session";
import type { Booking, ClassSession, Member } from "@/lib/db/types";

// `cookies()` is mocked so a test can present a signed session cookie (happy
// path) or omit it (401 path). Held in a hoisted closure so the mock factory can
// reference it without importing out-of-scope bindings.
const { cookieStore, setSessionCookie } = vi.hoisted(() => {
  let value: string | undefined;
  return {
    cookieStore: async () => ({
      get: (name: string) =>
        name === "studiobook_session" && value ? { value } : undefined,
    }),
    setSessionCookie: (v: string | undefined) => {
      value = v;
    },
  };
});

vi.mock("next/headers", () => ({ cookies: cookieStore }));

// Controlled seed: one member with a comma in their name, two sessions in
// different months, one booking per session — enough to exercise the header,
// the comma-quoting, and `from`/`to` date filtering.
const ISO = "2026-01-01T00:00:00.000Z";
function controlledSeed(): SeedData {
  const base = buildSeed(SEED_NOW);
  const studioId = base.studio.id;
  const member: Member = {
    id: "m1",
    studioId,
    name: "Rossi, Chiara",
    email: "chiara@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  };
  const classType = { ...base.classTypes[0], id: "ct1", studioId, name: "Vinyasa Flow" };
  const sessions: ClassSession[] = [
    {
      id: "cs1",
      studioId,
      classTypeId: "ct1",
      instructor: "Noor",
      startsAt: "2026-06-15T10:00:00.000Z",
      endsAt: "2026-06-15T11:00:00.000Z",
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: ISO,
    },
    {
      id: "cs2",
      studioId,
      classTypeId: "ct1",
      instructor: "Noor",
      startsAt: "2026-07-15T10:00:00.000Z",
      endsAt: "2026-07-15T11:00:00.000Z",
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: ISO,
    },
  ];
  const bookings: Booking[] = [
    { id: "b1", sessionId: "cs1", memberId: "m1", status: "booked", bookedAt: ISO, cancelledAt: null },
    { id: "b2", sessionId: "cs2", memberId: "m1", status: "booked", bookedAt: ISO, cancelledAt: null },
  ];
  return { ...base, members: [member], classTypes: [classType], sessions, bookings };
}

function request(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/export?type=bookings", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(controlledSeed()));
  });

  afterEach(() => {
    __setTestRepositories(null);
    setSessionCookie(undefined);
  });

  it("returns a CSV with the required header and a seeded booking row", async () => {
    setSessionCookie(await createSessionToken("owner@example.com"));
    const { GET } = await import("./route");
    const response = await GET(request("http://localhost/api/export?type=bookings"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    const body = await response.text();
    const lines = body.split("\r\n");
    expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
    // The comma in the member name is quoted as a single column.
    expect(lines[1]).toBe(
      '2026-06-15T10:00:00.000Z,Vinyasa Flow,"Rossi, Chiara",chiara@example.com,booked',
    );
    expect(lines[2]).toBe(
      '2026-07-15T10:00:00.000Z,Vinyasa Flow,"Rossi, Chiara",chiara@example.com,booked',
    );
  });

  it("narrows rows to the inclusive [from, to] range", async () => {
    setSessionCookie(await createSessionToken("owner@example.com"));
    const { GET } = await import("./route");
    const url =
      "http://localhost/api/export?type=bookings&from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.000Z";
    const response = await GET(request(url));
    const body = await response.text();
    const lines = body.split("\r\n");

    expect(lines).toHaveLength(2); // header + the one June booking
    expect(lines[1]).toContain("2026-06-15T10:00:00.000Z");
    expect(body).not.toContain("2026-07-15T10:00:00.000Z");
  });

  it("includes a session whose start exactly matches a bound (inclusive)", async () => {
    setSessionCookie(await createSessionToken("owner@example.com"));
    const { GET } = await import("./route");
    const url =
      "http://localhost/api/export?type=bookings&from=2026-06-15T10:00:00.000Z&to=2026-06-15T10:00:00.000Z";
    const response = await GET(request(url));
    const body = await response.text();

    expect(body).toContain("2026-06-15T10:00:00.000Z");
    expect(body).not.toContain("2026-07-15T10:00:00.000Z");
  });

  it("responds 401 without a signed-in session", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("http://localhost/api/export?type=bookings"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });
});
