import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { POST as packageRefundPost } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Pack } from "@/lib/db/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "owner@example.com" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("route handlers (against injected fake repositories)", () => {
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

  it("POST /api/packages creates the documented pack response", async () => {
    const res = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      memberId,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
  });

  it("GET /api/packages returns a member's packs newest first", async () => {
    const older: Pack = {
      id: "older-pack",
      studioId,
      memberId,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-03-01T00:00:00.000Z",
      createdAt: "2026-03-01T00:00:00.000Z",
    };
    await repos.packs.insert(older);
    await repos.packs.insert({
      ...older,
      id: "newer-pack",
      purchasedAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-03-02T00:00:00.000Z",
    });

    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${memberId}`),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject([{ id: "newer-pack" }, { id: "older-pack" }]);
  });

  it("POST /api/packages/:id/refund returns the refunded pack", async () => {
    const created = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    const pack = (await created.json()) as { id: string };

    const res = await packageRefundPost(new Request("http://localhost/api/packages/x/refund"), {
      params: Promise.resolve({ id: pack.id }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: pack.id,
      creditsRemaining: 0,
      status: "refunded",
    });
  });
});
