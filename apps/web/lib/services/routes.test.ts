import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The export route calls requireSession(), which reads the session cookie via
// next/headers' cookies() — unavailable here since these tests invoke route
// handlers directly rather than through Next's request-scoped async storage.
// Stub it to simulate an already-signed-in operator.
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }) };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");

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

  it("GET /api/export?type=bookings returns a bookings CSV", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings filters the session window inclusively at both ends", async () => {
    // NOW itself lands on a seeded session start (dayOffset 0, hour 12 UTC).
    const bound = "2026-03-15T12:00:00.000Z";
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${bound}&to=${bound}`),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.startsWith(bound)).toBe(true);
    }
  });

  it("GET /api/export?type=bookings excludes bookings just outside the from/to window", async () => {
    // Seeded sessions land only at 08:00/12:00/17:00 UTC each day, so a window
    // strictly between the 12:00 and 17:00 starts on the same day matches nothing.
    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-03-15T12:00:00.001Z&to=2026-03-15T16:59:59.999Z",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export with an unknown type returns 400", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=unknown"));
    expect(res.status).toBe(400);
  });
});
