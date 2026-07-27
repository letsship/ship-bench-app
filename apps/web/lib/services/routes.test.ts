import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as invoicesDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as membersDetailGet } from "@/app/api/members/[id]/route";
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

  it("GET /api/invoices/[id] returns invoice detail with async params", async () => {
    const seed = buildSeed(NOW);
    const invoiceId = seed.invoices[0].id;
    const res = await invoicesDetailGet(
      new NextRequest("http://localhost/api/invoices/" + invoiceId),
      {
        params: Promise.resolve({ id: invoiceId }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("invoice");
  });

  it("GET /api/members/[id] returns member detail with async params", async () => {
    const seed = buildSeed(NOW);
    const memberId = seed.members[0].id;
    const res = await membersDetailGet(
      new NextRequest("http://localhost/api/members/" + memberId),
      {
        params: Promise.resolve({ id: memberId }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("id");
  });
});
