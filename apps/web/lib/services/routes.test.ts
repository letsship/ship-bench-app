import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as bookingsGet } from "@/app/api/bookings/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
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

  it("GET /api/bookings returns rows with bounded repository reads", async () => {
    const base = buildSeed(NOW);
    const classTypeId = base.classTypes[0].id;
    const members = Array.from({ length: 50 }, (_, i) => ({
      ...base.members[0],
      id: `bm${i}`,
      name: `Bulk Member ${i}`,
      email: `bulk${i}@example.com`,
    }));
    const sessions = Array.from({ length: 50 }, (_, i) => ({
      ...base.sessions[0],
      id: `bcs${i}`,
      classTypeId,
      startsAt: new Date(NOW.getTime() + (i + 1) * 3_600_000).toISOString(),
      endsAt: new Date(NOW.getTime() + (i + 1) * 3_600_000 + 3_600_000).toISOString(),
    }));
    const bookings = Array.from({ length: 200 }, (_, i) => ({
      ...base.bookings[0],
      id: `bb${i}`,
      sessionId: `bcs${i % 50}`,
      memberId: `bm${i % 50}`,
    }));
    const seed: SeedData = { ...base, members, sessions, bookings };
    const repos = createInMemoryRepositories(seed);
    const membersSpy = vi.spyOn(repos.members, "listByStudio");
    const classSessionsSpy = vi.spyOn(repos.classSessions, "listByStudio");
    __setTestRepositories(repos);

    const res = await bookingsGet(new NextRequest("http://localhost/api/bookings"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string; startsAt: string }>;
    expect(body).toHaveLength(200);
    const sorted = [...body].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(body.map((row) => row.id)).toEqual(sorted.map((row) => row.id));
    expect(membersSpy).toHaveBeenCalledTimes(1);
    expect(classSessionsSpy).toHaveBeenCalledTimes(1);
  });
});
