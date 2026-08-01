import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as refundPackagePost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "operator@example.com" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("route handlers (against injected fake repositories)", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
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

  it("POST /api/packages creates a correctly priced pack", async () => {
    const studio = await repos.studios.getFirst();
    const member = (await repos.members.listByStudio(studio?.id ?? ""))[0];
    const res = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: member.id, credits: 5 }),
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      memberId: member.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: expect.any(String),
    });
  });

  it("GET /api/packages lists a member's packs newest first", async () => {
    const studio = await repos.studios.getFirst();
    const member = (await repos.members.listByStudio(studio?.id ?? ""))[0];
    const basePack = {
      studioId: studio?.id ?? "",
      memberId: member.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await repos.packs.insert({
      ...basePack,
      id: "old-pack",
      purchasedAt: "2026-01-01T00:00:00.000Z",
    });
    await repos.packs.insert({
      ...basePack,
      id: "new-pack",
      purchasedAt: "2026-02-01T00:00:00.000Z",
    });

    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${member.id}`),
    );

    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }[]).map((pack) => pack.id)).toEqual([
      "new-pack",
      "old-pack",
    ]);
  });

  it("POST /api/packages/:id/refund voids remaining credits", async () => {
    const studio = await repos.studios.getFirst();
    const member = (await repos.members.listByStudio(studio?.id ?? ""))[0];
    await repos.packs.insert({
      id: "pack-to-refund",
      studioId: studio?.id ?? "",
      memberId: member.id,
      creditsTotal: 10,
      creditsRemaining: 7,
      priceCents: 10000,
      status: "active",
      purchasedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
    });

    const res = await refundPackagePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "pack-to-refund" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ creditsRemaining: 0, status: "refunded" });
  });
});
