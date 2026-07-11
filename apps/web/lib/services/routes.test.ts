import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { POST as packageRefundPost } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// POST/PATCH route handlers call requireSession(), which reads next/headers's
// cookies() — unavailable outside a real request scope. Route-handler tests
// invoke handlers directly (no request scope), so the session check is
// stubbed here the same way providers.test.ts stubs the Resend boundary.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "operator@studiobook.test" }),
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

  it("GET /api/packages?memberId= returns that member's packs", async () => {
    const members = (await membersGet().then((r) => r.json())) as { id: string }[];
    const memberId = members[0].id;
    await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${memberId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);
  });

  it("GET /api/packages without memberId is a 400", async () => {
    const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(res.status).toBe(400);
  });

  it("POST /api/packages creates a 201 pack with the correct priceCents", async () => {
    const members = (await membersGet().then((r) => r.json())) as { id: string }[];
    const memberId = members[0].id;
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
    expect(body.priceCents).toBe(10000);
    expect(body.status).toBe("active");
  });

  it("POST /api/packages/:id/refund zeroes creditsRemaining and flips status", async () => {
    const members = (await membersGet().then((r) => r.json())) as { id: string }[];
    const memberId = members[0].id;
    const purchase = (await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    ).then((r) => r.json())) as { id: string };

    const res = await packageRefundPost(
      new Request("http://localhost/api/packages/x/refund", { method: "POST" }),
      {
        params: Promise.resolve({ id: purchase.id }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creditsRemaining: number; status: string };
    expect(body.creditsRemaining).toBe(0);
    expect(body.status).toBe("refunded");
  });
});
