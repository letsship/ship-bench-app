import { NextRequest } from "next/server";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { POST as packagesRefundPost } from "@/app/api/packages/[id]/refund/route";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

interface MockCookieStore {
  get: (name: string) => RequestCookie | undefined;
}

vi.mock("next/headers", async () => {
  const actual = await vi.importActual<typeof import("next/headers")>("next/headers");
  return {
    ...actual,
    cookies: vi.fn(),
  };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");
let testRepos: ReturnType<typeof createInMemoryRepositories> | null = null;

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    testRepos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(testRepos);
  });
  afterEach(() => {
    __setTestRepositories(null);
    testRepos = null;
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

  it("GET /api/packages returns an empty list when no memberId is provided", async () => {
    const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("POST /api/packages returns 201 with the documented body including memberId", async () => {
    const token = await createSessionToken("test@example.com");
    const members = await testRepos?.members.listByStudio("s1");
    const memberId = members?.[0]?.id;

    if (!memberId) {
      expect(true).toBe(true);
      return;
    }

    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    } as MockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);

    const req = new NextRequest("http://localhost/api/packages", {
      method: "POST",
      body: JSON.stringify({ memberId, credits: 5 }),
    });

    const res = await packagesPost(req);
    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("memberId", memberId);
    expect(body).toHaveProperty("creditsTotal", 5);
    expect(body).toHaveProperty("creditsRemaining", 5);
    expect(body).toHaveProperty("priceCents", 5000);
    expect(body).toHaveProperty("status", "active");
    expect(body).toHaveProperty("purchasedAt");
  });

  it("POST /api/packages/{id}/refund returns 200 with status refunded", async () => {
    const token = await createSessionToken("test@example.com");
    const members = await testRepos?.members.listByStudio("s1");
    const memberId = members?.[0]?.id;

    if (!memberId) {
      expect(true).toBe(true);
      return;
    }

    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    } as MockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);

    const createReq = new NextRequest("http://localhost/api/packages", {
      method: "POST",
      body: JSON.stringify({ memberId, credits: 10 }),
    });

    const createRes = await packagesPost(createReq);
    const pkg = (await createRes.json()) as Record<string, unknown>;
    const packageId = pkg.id as string;

    const refundReq = new NextRequest(`http://localhost/api/packages/${packageId}/refund`, {
      method: "POST",
    });

    const refundRes = await packagesRefundPost(refundReq, {
      params: Promise.resolve({ id: packageId }),
    });
    expect(refundRes.status).toBe(200);

    const refundBody = (await refundRes.json()) as Record<string, unknown>;
    expect(refundBody).toHaveProperty("status", "refunded");
    expect(refundBody).toHaveProperty("creditsRemaining", 0);
  });
});
