import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { POST as packageRefundPost } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { ClassPack, ClassSession, ClassType } from "@/lib/db/types";

// requireSession() reads cookies() from next/headers, which has no request
// context in a unit test. Stub it to an authenticated session for POST routes.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "front-desk@example.com" }),
  SESSION_COOKIE: "sb-session",
}));

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

// POST routes call createNotificationProvider(); run under fake-backends so the
// provider is the in-memory recorder (no RESEND_API_KEY needed). The injected
// test repositories still win over the fake-backends path.
describe("package + booking POST routes (against injected fake repositories)", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;
  let classTypeId: string;

  beforeEach(() => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  async function freshFutureSession(): Promise<string> {
    const studio = await repos.studios.getFirst();
    const [classType] = (await repos.classTypes.listByStudio(studio!.id)) as ClassType[];
    classTypeId = classType.id;
    const startsAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const session: ClassSession = {
      id: "cs-fresh",
      studioId: studio!.id,
      classTypeId,
      instructor: "I",
      startsAt,
      endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    };
    await repos.classSessions.insert(session);
    return session.id;
  }

  async function seedMember(): Promise<void> {
    const studio = await repos.studios.getFirst();
    studioId = studio!.id;
    const [member] = await repos.members.listByStudio(studioId);
    memberId = member.id;
  }

  it("POST /api/packages creates a 5-credit pack and returns 201 with the documented body", async () => {
    await seedMember();
    const res = await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      memberId,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(Object.keys(body).sort()).toEqual(
      ["creditsRemaining", "creditsTotal", "id", "memberId", "priceCents", "purchasedAt", "status"].sort(),
    );
  });

  it("POST /api/packages prices a 10-credit pack at 10000", async () => {
    await seedMember();
    const res = await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { priceCents: number }).priceCents).toBe(10000);
  });

  it("POST /api/packages rejects an unsupported credit size with 400", async () => {
    await seedMember();
    const res = await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 7 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/packages?memberId= lists a member's packs newest first", async () => {
    await seedMember();
    await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${memberId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; creditsRemaining: number }[];
    expect(body.length).toBe(1);
    expect(body[0].creditsRemaining).toBe(5);
  });

  it("POST /api/packages/:id/refund voids remaining credits and marks refunded", async () => {
    await seedMember();
    const created = await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const res = await packageRefundPost(
      new NextRequest(`http://localhost/api/packages/${id}/refund`, { method: "POST" }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, creditsRemaining: 0, status: "refunded" });
  });

  it("POST /api/bookings returns 402 pack_exhausted for a member whose packs are all spent", async () => {
    await seedMember();
    const sessionId = await freshFutureSession();
    const exhausted: ClassPack = {
      id: "p-spent",
      studioId,
      memberId,
      creditsTotal: 5,
      creditsRemaining: 0,
      priceCents: 5000,
      status: "active",
      purchasedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
    };
    await repos.packages.insert(exhausted);

    const res = await bookingsPost(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId, memberId }),
      }),
    );
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: { code: "pack_exhausted" } });
    expect(await repos.bookings.listBySession(sessionId)).toEqual([]);
  });

  it("POST /api/bookings spends a credit when a member with an active pack books", async () => {
    await seedMember();
    const sessionId = await freshFutureSession();
    const pack: ClassPack = {
      id: "p-active",
      studioId,
      memberId,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
    };
    await repos.packages.insert(pack);

    const res = await bookingsPost(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId, memberId }),
      }),
    );
    expect(res.status).toBe(201);
    expect((await repos.packages.getById("p-active"))?.creditsRemaining).toBe(4);
  });
});
