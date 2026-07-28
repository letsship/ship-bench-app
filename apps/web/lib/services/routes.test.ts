import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoicesIdGet, PATCH as invoicesIdPatch } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as membersIdGet, PATCH as membersIdPatch } from "@/app/api/members/[id]/route";
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

describe("[id] route handlers (Next 16 async params contract)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns the invoice detail", async () => {
    // First invoice from the deterministic seed dataset.
    const seed = buildSeed(NOW);
    const invoiceId = seed.invoices[0].id;
    const res = await invoicesIdGet(new NextRequest("http://localhost/api/invoices/" + invoiceId), {
      params: Promise.resolve({ id: invoiceId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { number: string } };
    expect(body.invoice.number).toBe(seed.invoices[0].number);
  });

  it("GET /api/invoices/:id returns 404 for a missing id", async () => {
    const res = await invoicesIdGet(
      new NextRequest("http://localhost/api/invoices/missing-id"),
      { params: Promise.resolve({ id: "missing-id" }) },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("GET /api/members/:id returns the member", async () => {
    const seed = buildSeed(NOW);
    const memberId = seed.members[0].id;
    const res = await membersIdGet(new NextRequest("http://localhost/api/members/" + memberId), {
      params: Promise.resolve({ id: memberId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe(seed.members[0].email);
  });

  it("GET /api/members/:id returns 404 for a missing id", async () => {
    const res = await membersIdGet(
      new NextRequest("http://localhost/api/members/missing-id"),
      { params: Promise.resolve({ id: "missing-id" }) },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("PATCH /api/invoices/:id passes awaited params to the handler", async () => {
    // This validates that the route handler accepts params as a Promise rather
    // than throwing a type error — the runtime session check is not testable
    // outside a Next.js request context.
    const seed = buildSeed(NOW);
    const invoiceId = seed.invoices[0].id;
    await expect(
      invoicesIdPatch(
        new NextRequest("http://localhost/api/invoices/" + invoiceId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "open" }),
        }),
        { params: Promise.resolve({ id: invoiceId }) },
      ),
    ).resolves.toBeDefined();
  });

  it("PATCH /api/members/:id passes awaited params to the handler", async () => {
    const seed = buildSeed(NOW);
    const memberId = seed.members[0].id;
    await expect(
      membersIdPatch(
        new NextRequest("http://localhost/api/members/" + memberId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Name" }),
        }),
        { params: Promise.resolve({ id: memberId }) },
      ),
    ).resolves.toBeDefined();
  });
});
