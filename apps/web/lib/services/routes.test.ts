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
import { resolveStudio } from "@/lib/services/context";

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

  it("GET /api/invoices/:id awaits Promise params and returns the invoice detail", async () => {
    const { repos, ctx } = await resolveStudio();
    const [invoice] = await repos.invoices.listByStudio(ctx.studio.id);
    expect(invoice).toBeDefined();
    // Next 16 hands route handlers `params` as a Promise that must be awaited.
    let awaited = false;
    const params = Promise.resolve({ id: invoice.id }).then((value) => {
      awaited = true;
      return value;
    });
    const res = await invoiceDetailGet(new NextRequest(`http://localhost/api/invoices/${invoice.id}`), {
      params,
    });
    expect(awaited).toBe(true);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string }; lineItems: unknown[] };
    expect(body.invoice.id).toBe(invoice.id);
    expect(Array.isArray(body.lineItems)).toBe(true);
  });

  it("GET /api/members/:id awaits Promise params and returns the member", async () => {
    const { repos, ctx } = await resolveStudio();
    const [member] = await repos.members.listByStudio(ctx.studio.id);
    expect(member).toBeDefined();
    let awaited = false;
    const params = Promise.resolve({ id: member.id }).then((value) => {
      awaited = true;
      return value;
    });
    const res = await memberDetailGet(new NextRequest(`http://localhost/api/members/${member.id}`), {
      params,
    });
    expect(awaited).toBe(true);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(member.id);
  });
});
