import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as packageRefundPost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

// Route handlers guard writes behind requireSession(), which reads cookies
// from next/headers — unavailable in the vitest node environment. Stub the
// session seam so handler logic (not auth) is under test.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "front-desk@example.com" }),
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

describe("package route handlers (against injected fake repositories)", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  const seedPack = async (id: string, purchasedAt: string, creditsRemaining = 5) =>
    repos.classPacks.insert({
      id,
      studioId,
      memberId,
      creditsTotal: 5,
      creditsRemaining,
      priceCents: 5000,
      status: "active",
      purchasedAt,
      createdAt: purchasedAt,
    });

  it("POST /api/packages creates a pack and responds 201", async () => {
    const res = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    expect(body.id).toBeTruthy();
    expect(body.purchasedAt).toBeTruthy();
  });

  it("POST /api/packages rejects a credits value other than 5 or 10", async () => {
    const res = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, credits: 7 }),
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("bad_request");
  });

  it("GET /api/packages?memberId= lists the member's packs newest first", async () => {
    await seedPack("p_old", "2026-01-01T10:00:00.000Z");
    await seedPack("p_new", "2026-02-01T10:00:00.000Z");
    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${memberId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.map((pack) => pack.id)).toEqual(["p_new", "p_old"]);
    expect(body[0]).not.toHaveProperty("memberId");
  });

  it("GET /api/packages without memberId is a 400", async () => {
    const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(res.status).toBe(400);
  });

  it("POST /api/packages/:id/refund voids the pack's remaining credits", async () => {
    await seedPack("p1", "2026-01-01T10:00:00.000Z");
    const res = await packageRefundPost(new Request("http://localhost/api/packages/p1/refund"), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("refunded");
    expect(body.creditsRemaining).toBe(0);
  });
});
