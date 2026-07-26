import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("GET /api/export?type=bookings", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a CSV with the required headers and content-disposition", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const body = await res.text();
    const [header] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("includes booking rows joined to member and class", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const body = await res.text();
    const rows = body.split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("narrows rows with from/to, inclusive of both ends", async () => {
    const { GET } = await import("./route");
    const full = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const fullRows = (await full.text()).split("\r\n").slice(1);
    expect(fullRows.length).toBeGreaterThan(0);

    const firstDataRow = fullRows[0];
    const startsAt = firstDataRow.split(",")[0];

    const narrowed = await GET(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${encodeURIComponent(startsAt)}&to=${encodeURIComponent(startsAt)}`,
      ),
    );
    const narrowedRows = (await narrowed.text()).split("\r\n").slice(1);
    expect(narrowedRows.length).toBeGreaterThan(0);
    for (const row of narrowedRows) {
      expect(row.startsWith(startsAt)).toBe(true);
    }

    const empty = await GET(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z&to=2099-01-02T00:00:00.000Z",
      ),
    );
    const emptyRows = (await empty.text()).split("\r\n").slice(1);
    expect(emptyRows).toEqual([]);
  });

  it("still requires a signed-in session", async () => {
    const { requireSession } = await import("@/lib/auth/session");
    vi.mocked(requireSession).mockRejectedValueOnce(
      new HttpError(401, "unauthorized", "Sign in required"),
    );
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
