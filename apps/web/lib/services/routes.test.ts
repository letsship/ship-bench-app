import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as bookingsGet } from "@/app/api/bookings/route";
import { GET as classesGet } from "@/app/api/classes/route";
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

  it("GET /api/bookings returns booking rows joined to member and session, sorted by startsAt", async () => {
    const res = await bookingsGet(new NextRequest("http://localhost/api/bookings"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{
      id: string;
      memberName: string;
      className: string;
      classColor: string;
      instructor: string;
      startsAt: string;
      status: string;
    }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const row of body) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("memberName");
      expect(row).toHaveProperty("className");
      expect(row).toHaveProperty("classColor");
      expect(row).toHaveProperty("instructor");
      expect(row).toHaveProperty("startsAt");
      expect(row).toHaveProperty("status");
    }
    const sorted = [...body].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(body).toEqual(sorted);
  });
});
