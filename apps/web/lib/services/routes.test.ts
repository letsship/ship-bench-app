import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as refundPackagePost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Route handlers that call requireSession() read the session cookie via
// next/headers' cookies(), which only works inside a real request context.
// Stub it with a valid, HMAC-signed token so POST handlers can be exercised
// directly, the same way the (mocked) request context would supply it.
let sessionCookieValue = "";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === SESSION_COOKIE ? { value: sessionCookieValue } : undefined),
  }),
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

  it("GET /api/packages?memberId= returns that member's packs, newest first", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const [member] = await repos.members.listByStudio(studio?.id ?? "");
    const older = await repos.packages.insert({
      id: "pkg-older",
      studioId: studio?.id ?? "",
      memberId: member.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = await repos.packages.insert({
      id: "pkg-newer",
      studioId: studio?.id ?? "",
      memberId: member.id,
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
      purchasedAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const res = await packagesGet(
      new NextRequest(`http://localhost/api/packages?memberId=${member.id}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(body.map((row) => row.id)).toEqual([newer.id, older.id]);
  });
});

describe("POST route handlers requiring a session (against injected fake repositories)", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeAll(async () => {
    sessionCookieValue = await createSessionToken("owner@example.com");
  });
  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("POST /api/packages returns 201 with the documented package fields", async () => {
    const studio = await repos.studios.getFirst();
    const [member] = await repos.members.listByStudio(studio?.id ?? "");

    const res = await packagesPost(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId: member.id, credits: 5 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      memberId: member.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(body.id).toBeTruthy();
    expect(body.purchasedAt).toBeTruthy();
  });

  it("POST /api/packages/:id/refund returns the refunded pack", async () => {
    const studio = await repos.studios.getFirst();
    const [member] = await repos.members.listByStudio(studio?.id ?? "");
    const pack = await repos.packages.insert({
      id: "pkg-1",
      studioId: studio?.id ?? "",
      memberId: member.id,
      creditsTotal: 10,
      creditsRemaining: 7,
      priceCents: 10000,
      status: "active",
      purchasedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await refundPackagePost(
      new Request("http://localhost/api/packages/pkg-1/refund", { method: "POST" }),
      { params: Promise.resolve({ id: pack.id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.creditsRemaining).toBe(0);
    expect(body.status).toBe("refunded");
  });
});
