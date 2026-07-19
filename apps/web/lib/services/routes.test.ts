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

  it("GET /api/invoices/:id returns an invoice with member and line items", async () => {
    const _members = (await membersGet().then((r) => r.json())) as { id: string }[];
    const invoices = (await invoicesGet().then((r) => r.json())) as { id: string }[];
    const invoiceId = invoices[0].id;
    const res = await invoiceDetailGet(new NextRequest("http://localhost/api/invoices/123"), {
      params: Promise.resolve({ id: invoiceId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("invoice");
    expect(body).toHaveProperty("member");
    expect(body).toHaveProperty("lineItems");
  });

  it("GET /api/members/:id returns a single member", async () => {
    const members = (await membersGet().then((r) => r.json())) as { id: string }[];
    const memberId = members[0].id;
    const res = await memberDetailGet(new NextRequest("http://localhost/api/members/123"), {
      params: Promise.resolve({ id: memberId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("email");
  });
});
