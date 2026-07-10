import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as packagesGet } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  let seed: SeedData;

  beforeEach(() => {
    seed = buildSeed(NOW);
    seed.classPackages = [
      {
        id: "pkg-1",
        studioId: seed.studio.id,
        memberId: seed.members[0].id,
        creditsTotal: 5,
        creditsRemaining: 4,
        priceCents: 1000,
        status: "active",
        purchasedAt: NOW.toISOString(),
      },
      {
        id: "pkg-2",
        studioId: seed.studio.id,
        memberId: seed.members[1].id,
        creditsTotal: 10,
        creditsRemaining: 10,
        priceCents: 1000,
        status: "active",
        purchasedAt: NOW.toISOString(),
      },
    ];
    __setTestRepositories(createInMemoryRepositories(seed));
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

  it("GET /api/packages?memberId= returns only that member's packs", async () => {
    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${seed.members[0].id}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; creditsRemaining: number }[];
    expect(body).toEqual([expect.objectContaining({ id: "pkg-1", creditsRemaining: 4 })]);
  });
});
