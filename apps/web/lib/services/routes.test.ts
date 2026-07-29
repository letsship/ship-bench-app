import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
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

  // Next 16 contract: `params` is a Promise that must be awaited. Passing a
  // real Promise here locks that in — a synchronous `const { id } = params`
  // would yield `undefined` and the handler would 404 instead of returning 200.
  it("GET /api/members/[id] awaits its params Promise and returns the member", async () => {
    const listRes = await membersGet();
    const members = (await listRes.json()) as Array<{ id: string; name: string }>;
    const { id, name } = members[0];

    const res = await memberDetailGet(new NextRequest(`http://localhost/api/members/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; name: string };
    expect(body.id).toBe(id);
    expect(body.name).toBe(name);
  });

  it("GET /api/invoices/[id] awaits its params Promise and returns the invoice", async () => {
    const listRes = await invoicesGet();
    const invoices = (await listRes.json()) as Array<{ id: string; number: string }>;
    const { id, number } = invoices[0];

    const res = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string; number: string } };
    expect(body.invoice.id).toBe(id);
    expect(body.invoice.number).toBe(number);
  });
});
