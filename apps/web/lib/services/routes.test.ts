import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as packagesPOST, GET as packagesGET } from "@/app/api/packages/route";
import { POST as refundPOST } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/provider", () => ({
  createNotificationProvider: vi.fn(() => ({})),
}));

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

describe("Packages API (POST/GET packages and refund endpoints)", () => {
  let repos = createInMemoryRepositories();
  let memberId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
    memberId = seed.members[0].id;
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("POST /api/packages creates a 5-credit pack and returns 201", async () => {
    const res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBeDefined();
    expect(body.creditsTotal).toBe(5);
    expect(body.creditsRemaining).toBe(5);
    expect(body.priceCents).toBe(5000);
    expect(body.status).toBe("active");
  });

  it("POST /api/packages creates a 10-credit pack with price 10000", async () => {
    const res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.creditsTotal).toBe(10);
    expect(body.creditsRemaining).toBe(10);
    expect(body.priceCents).toBe(10000);
  });

  it("GET /api/packages?memberId lists member's packs newest first", async () => {
    // Create two packs
    const pack1Res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    const pack1 = (await pack1Res.json()) as Record<string, unknown>;

    const pack2Res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    const pack2 = (await pack2Res.json()) as Record<string, unknown>;

    // List them
    const res = await packagesGET(
      new NextRequest("http://localhost/api/packages?memberId=" + memberId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe(pack2.id);
    expect(body[1].id).toBe(pack1.id);
  });

  it("POST /api/packages/:id/refund sets creditsRemaining to 0 and status to refunded", async () => {
    const packRes = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    const pack = (await packRes.json()) as Record<string, unknown>;

    const refundRes = await refundPOST(
      new Request("http://localhost/api/packages/" + pack.id + "/refund", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: pack.id as string }) },
    );
    expect(refundRes.status).toBe(200);
    const refunded = (await refundRes.json()) as Record<string, unknown>;
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });
});
