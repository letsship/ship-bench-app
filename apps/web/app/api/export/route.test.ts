import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { HttpError } from "@/lib/http";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
// Exact session starts in the seed (a week back to a week ahead, hours 8/12/17).
const FROM = "2026-03-12T08:00:00.000Z";
const TO = "2026-03-18T17:00:00.000Z";

let requireSessionMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/session", () => ({
  get requireSession() {
    return requireSessionMock;
  },
}));

function exportRequest(type?: string, from?: string, to?: string): NextRequest {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return new NextRequest(`http://localhost/api/export${query ? `?${query}` : ""}`);
}

describe("GET /api/export", () => {
  beforeEach(() => {
    requireSessionMock = vi.fn(async () => ({ email: "owner@example.com" }));
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.restoreAllMocks();
  });

  it("returns 401 with the JSON error envelope when unauthenticated", async () => {
    requireSessionMock = vi.fn(async () => {
      throw new HttpError(401, "unauthorized", "Sign in required");
    });
    const res = await GET(exportRequest("bookings"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 200 + text/csv for ?type=bookings with the documented header", async () => {
    const res = await GET(exportRequest("bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const csv = await res.text();
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("filters to the closed [from, to] interval", async () => {
    const res = await GET(exportRequest("bookings", FROM, TO));
    expect(res.status).toBe(200);
    const csv = await res.text();
    const [, ...rows] = csv.split("\r\n").filter((line) => line.length > 0);
    expect(rows.length).toBeGreaterThan(0);
    const starts = rows.map((row) => row.split(",")[0]);
    expect(starts.some((value) => value === FROM)).toBe(true);
    expect(starts.some((value) => value === TO)).toBe(true);
    for (const value of starts) {
      expect(value >= FROM).toBe(true);
      expect(value <= TO).toBe(true);
    }
  });

  it("leaves an omitted bound unbounded on that side", async () => {
    const res = await GET(exportRequest("bookings", FROM));
    expect(res.status).toBe(200);
    const csv = await res.text();
    const [, ...rows] = csv.split("\r\n").filter((line) => line.length > 0);
    const starts = rows.map((row) => row.split(",")[0]);
    for (const value of starts) expect(value >= FROM).toBe(true);
    expect(starts.some((value) => value > TO)).toBe(true);
  });

  it("honors a `to` bound written with a UTC offset (same instant, other text)", async () => {
    // 2026-03-18T16:00:00-02:00 == 2026-03-18T18:00:00Z, which is AFTER the
    // 17:00Z session. Comparing the bound as text ("16..." < "17...") would
    // drop the TO booking; comparing as an instant must keep it. This is the
    // QA failure scenario.
    const res = await GET(exportRequest("bookings", FROM, "2026-03-18T16:00:00-02:00"));
    expect(res.status).toBe(200);
    const csv = await res.text();
    const [, ...rows] = csv.split("\r\n").filter((line) => line.length > 0);
    const starts = rows.map((row) => row.split(",")[0]);
    expect(starts.some((value) => value === TO)).toBe(true);
  });

  it("defaults to the members export when type is omitted", async () => {
    const res = await GET(exportRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-members.csv"',
    );
    const [header] = (await res.text()).split("\r\n");
    expect(header).toBe("Name,Email,Phone,Status,Joined");
  });

  it("still returns the members CSV for ?type=members", async () => {
    const res = await GET(exportRequest("members"));
    expect(res.status).toBe(200);
    const [header] = (await res.text()).split("\r\n");
    expect(header).toBe("Name,Email,Phone,Status,Joined");
  });

  it("still returns the invoices CSV for ?type=invoices", async () => {
    const res = await GET(exportRequest("invoices"));
    expect(res.status).toBe(200);
    const [header] = (await res.text()).split("\r\n");
    expect(header).toBe("Number,Member,Status,Issued,Total,Currency");
  });

  it("returns 400 for an unknown type", async () => {
    const res = await GET(exportRequest("nope"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_request");
  });
});