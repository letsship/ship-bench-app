import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { POST as packagesRefundPost } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "operator@example.com" }),
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
  let memberId: string;

  beforeEach(async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    memberId = (await repos.members.listByStudio(studio!.id))[0].id;
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/packages?memberId= returns that member's packs", async () => {
    const created = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    expect(created.status).toBe(201);

    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${memberId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creditsRemaining: number }[];
    expect(body).toHaveLength(1);
    expect(body[0].creditsRemaining).toBe(5);
  });

  it("POST /api/packages creates an active 10-credit pack (201)", async () => {
    const res = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      creditsTotal: number;
      creditsRemaining: number;
      priceCents: number;
      status: string;
    };
    expect(body.creditsTotal).toBe(10);
    expect(body.creditsRemaining).toBe(10);
    expect(body.priceCents).toBe(10_000);
    expect(body.status).toBe("active");
  });

  it("POST /api/packages/:id/refund voids the remaining credits (200)", async () => {
    const created = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    const { id } = (await created.json()) as { id: string };

    const res = await packagesRefundPost(
      new Request(`http://localhost/api/packages/${id}/refund`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creditsRemaining: number; status: string };
    expect(body.creditsRemaining).toBe(0);
    expect(body.status).toBe("refunded");
  });
});
