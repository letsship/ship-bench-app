import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as packagesRefundPost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
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

  it("GET /api/packages without memberId returns 400", async () => {
    const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(res.status).toBe(400);
  });

  it("buys, lists, and refunds a class pack", async () => {
    const membersRes = await membersGet();
    const [firstMember] = (await membersRes.json()) as { id: string }[];

    const postRes = await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId: firstMember.id, credits: 5 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as {
      id: string;
      memberId: string;
      creditsTotal: number;
      creditsRemaining: number;
      priceCents: number;
      status: string;
    };
    expect(created).toMatchObject({
      memberId: firstMember.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });

    const listRes = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${firstMember.id}`),
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { id: string }[];
    expect(list.map((row) => row.id)).toContain(created.id);

    const refundRes = await packagesRefundPost(
      new NextRequest(`http://localhost/api/packages/${created.id}/refund`, { method: "POST" }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(refundRes.status).toBe(200);
    const refunded = (await refundRes.json()) as { status: string; creditsRemaining: number };
    expect(refunded.status).toBe("refunded");
    expect(refunded.creditsRemaining).toBe(0);
  });
});
