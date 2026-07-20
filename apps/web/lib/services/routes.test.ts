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

describe("Detail route handlers (scoped to owner studio)", () => {
  let baseRepos;
  let studioId: string;
  beforeEach(async () => {
    const seed = buildSeed(new Date());
    baseRepos = createInMemoryRepositories(seed);
    const studio = await baseRepos.studios.getFirst();
    studioId = studio?.id ?? "";
    __setTestRepositories(baseRepos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns 404 for foreign invoice", async () => {
    const invoices = await baseRepos.invoices.listByStudio(studioId);
    if (invoices.length === 0) throw new Error("No invoice in studio");

    const res = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/foreign-id"),
      {
        params: Promise.resolve({ id: "foreign-id" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/invoices/:id returns 200 for owned invoice", async () => {
    const invoices = await baseRepos.invoices.listByStudio(studioId);
    if (invoices.length === 0) throw new Error("No invoice in studio");
    const ownedId = invoices[0].id;

    const res = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/" + ownedId),
      {
        params: Promise.resolve({ id: ownedId }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.id).toBe(ownedId);
  });

  it("GET /api/members/:id returns 404 for foreign member", async () => {
    const res = await memberDetailGet(new NextRequest("http://localhost/api/members/foreign-id"), {
      params: Promise.resolve({ id: "foreign-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id returns 200 for owned member", async () => {
    const members = await baseRepos.members.listByStudio(studioId);
    if (members.length === 0) throw new Error("No member in studio");
    const ownedId = members[0].id;

    const res = await memberDetailGet(new NextRequest("http://localhost/api/members/" + ownedId), {
      params: Promise.resolve({ id: ownedId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ownedId);
  });
});
