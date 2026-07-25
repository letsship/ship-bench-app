import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersDetailGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
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
});

describe("Detail route handlers with studio isolation", () => {
  const member = (id: string, over: Partial<Member> = {}): Member => ({
    id,
    studioId: "s1",
    name: id,
    email: `${id}@e.co`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: NOW.toISOString(),
    ...over,
  });

  const classType = (id: string): ClassType => ({
    id,
    studioId: "s1",
    name: "Yoga",
    description: null,
    color: "#111111",
    defaultCapacity: 10,
    defaultPriceCents: 1000,
    createdAt: NOW.toISOString(),
  });

  const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
    id,
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "I",
    startsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
    endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString(),
    capacity: 10,
    priceCents: 1000,
    status: "scheduled",
    createdAt: NOW.toISOString(),
    ...over,
  });

  const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
    id,
    sessionId: "cs1",
    memberId,
    status: "booked",
    bookedAt: NOW.toISOString(),
    cancelledAt: null,
    ...over,
  });

  beforeEach(() => {
    const seed = buildSeed(NOW);
    // Add foreign studio records
    seed.members.push(member("fm1", { studioId: "s2" }));
    seed.classTypes.push({ ...classType("ct1"), studioId: "s2" });
    seed.sessions.push(session("fcs1", { studioId: "s2" }));
    seed.bookings.push(booking("fb1", "fm1", { sessionId: "fcs1" }));
    // Add foreign invoice
    seed.invoices.push({
      id: "finv1",
      studioId: "s2",
      memberId: "fm1",
      number: "F-001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 1000,
      taxCents: 90,
      totalCents: 1090,
      issuedAt: NOW.toISOString(),
      dueAt: new Date(NOW.getTime() + 14 * 86_400_000).toISOString(),
      paidAt: null,
      createdAt: NOW.toISOString(),
    });
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns 404 for a foreign studio's invoice", async () => {
    const res = await invoicesDetailGet(new NextRequest("http://localhost/api/invoices/finv1"), {
      params: Promise.resolve({ id: "finv1" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id returns 404 for a foreign studio's member", async () => {
    const res = await membersDetailGet(new NextRequest("http://localhost/api/members/fm1"), {
      params: Promise.resolve({ id: "fm1" }),
    });
    expect(res.status).toBe(404);
  });
});
