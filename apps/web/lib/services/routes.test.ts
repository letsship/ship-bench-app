import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

// The export route requires a signed-in session: serve a valid session cookie.
// The HMAC-signed token is minted inline (mirroring lib/auth/session.ts, whose
// helpers cannot be imported here because the factory is hoisted) using the
// default dev secret.
vi.mock("next/headers", async () => {
  const b64url = (bytes: Uint8Array): string =>
    btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const encoder = new TextEncoder();
  const body = b64url(
    encoder.encode(JSON.stringify({ email: "operator@example.com", issuedAt: Date.now() })),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.STUDIOBOOK_SESSION_SECRET ?? "studiobook-dev-session-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const token = `${body}.${b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body))))}`;
  return {
    cookies: async () => ({
      get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    }),
  };
});
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

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

  it("GET /api/export?type=bookings returns a CSV with the bookings header", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
    const csv = await res.text();
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("GET /api/export?type=bookings filters by session start, inclusive of both bounds", async () => {
    const unfiltered = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    const allRows = (await unfiltered.text()).split("\r\n").slice(1);
    const starts = allRows.map((row) => row.split(",")[0]).sort();
    const from = starts[Math.floor(starts.length / 2) - 1];
    const to = starts[Math.floor(starts.length / 2)];
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${from}&to=${to}`),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const startsAt = row.split(",")[0];
      expect(startsAt >= from && startsAt <= to).toBe(true);
    }
    // Inclusive on both ends: sessions starting exactly at from/to appear.
    expect(rows.some((row) => row.split(",")[0] === from)).toBe(true);
    expect(rows.some((row) => row.split(",")[0] === to)).toBe(true);
  });

  it("GET /api/export?type=bookings honours a single omitted bound as unbounded", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export with an unknown type returns badRequest", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=nope"));
    expect(res.status).toBe(400);
  });
});
