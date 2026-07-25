import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

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

describe("Detail route handlers with cross-studio protection", () => {
  const NOW = new Date("2026-03-15T12:00:00.000Z");
  const ISO = NOW.toISOString();

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns 404 for a foreign invoice", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    await repos.members.insert({
      id: "foreign-member",
      studioId: "s2",
      name: "Foreign",
      email: "foreign@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });
    await repos.invoices.insert({
      id: "foreign-invoice",
      studioId: "s2",
      memberId: "foreign-member",
      number: "INV-999",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 1000,
      taxCents: 90,
      totalCents: 1090,
      issuedAt: ISO,
      dueAt: ISO,
      paidAt: null,
      createdAt: ISO,
    });
    __setTestRepositories(repos);
    const res = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      {
        params: Promise.resolve({ id: "foreign-invoice" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id returns 404 for a foreign member", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    await repos.members.insert({
      id: "foreign-member",
      studioId: "s2",
      name: "Foreign",
      email: "foreign@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });
    __setTestRepositories(repos);
    const res = await memberDetailGet(
      new NextRequest("http://localhost/api/members/foreign-member"),
      {
        params: Promise.resolve({ id: "foreign-member" }),
      },
    );
    expect(res.status).toBe(404);
  });
});
