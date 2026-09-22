import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("GET /api/public/schedule returns unauthenticated public classes", async () => {
    const { GET: publicScheduleGet } = await import("@/app/api/public/schedule/route");
    const res = await publicScheduleGet(
      new NextRequest("http://localhost/api/public/schedule?studio=s1"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("title");
      expect(body[0]).toHaveProperty("startsAt");
      expect(body[0]).toHaveProperty("durationMinutes");
      expect(body[0]).toHaveProperty("instructor");
      expect(body[0]).toHaveProperty("seatsAvailable");
    }
  });

  it("GET /api/public/schedule returns 400 when studio param is missing", async () => {
    const { GET: publicScheduleGet } = await import("@/app/api/public/schedule/route");
    const res = await publicScheduleGet(new NextRequest("http://localhost/api/public/schedule"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("error");
  });

  it("GET /api/public/schedule excludes member/booking/invoice PII", async () => {
    const { GET: publicScheduleGet } = await import("@/app/api/public/schedule/route");
    const res = await publicScheduleGet(
      new NextRequest("http://localhost/api/public/schedule?studio=s1"),
    );
    expect(res.status).toBe(200);
    const responseText = await res.clone().text();
    // Assert that sensitive fields are not present
    expect(responseText).not.toContain("email");
    expect(responseText).not.toContain("memberId");
    expect(responseText).not.toContain("priceCents");
    expect(responseText).not.toContain("invoice");
    expect(responseText).not.toContain("booking");
  });
});
