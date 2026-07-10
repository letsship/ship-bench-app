import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as refundPackagePost } from "@/app/api/packages/[id]/refund/route";
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

  it("POST /api/packages buys a pack with the documented response shape", async () => {
    const memberId = (await membersGet().then((res) => res.json()))[0].id as string;
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
    expect(body.id).toBeTruthy();
    expect(body.purchasedAt).toBeTruthy();
  });

  it("GET /api/packages lists a member's packs newest first", async () => {
    const memberId = (await membersGet().then((res) => res.json()))[0].id as string;
    await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${memberId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creditsTotal: number; purchasedAt: string }[];
    expect(body).toHaveLength(2);
    expect(new Date(body[0].purchasedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body[1].purchasedAt).getTime(),
    );
  });

  it("GET /api/packages 400s when memberId is omitted", async () => {
    const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(res.status).toBe(400);
  });

  it("POST /api/packages/:id/refund voids the remaining credits", async () => {
    const memberId = (await membersGet().then((res) => res.json()))[0].id as string;
    const purchased = (await packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    ).then((res) => res.json())) as { id: string };

    const res = await refundPackagePost(
      new NextRequest("http://localhost/api/packages/x/refund", { method: "POST" }),
      {
        params: Promise.resolve({ id: purchased.id }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creditsRemaining: number; status: string };
    expect(body).toMatchObject({ creditsRemaining: 0, status: "refunded" });
  });
});
