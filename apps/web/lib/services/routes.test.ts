import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoicesIdGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as membersIdGet } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const INVOICE_ID = "00000000-0000-4000-8000-0000000000ea";
const MEMBER_ID = "00000000-0000-4000-8000-000000000002";

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

  it("GET /api/invoices/[id] returns a single invoice (params as Promise)", async () => {
    const res = await invoicesIdGet(new NextRequest("http://localhost/api/invoices/id"), {
      params: Promise.resolve({ id: INVOICE_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice?: { number: string } };
    expect(body.invoice?.number).toBe("INV-2026-0001");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/members/[id] returns a single member (params as Promise)", async () => {
    const res = await membersIdGet(new NextRequest("http://localhost/api/members/id"), {
      params: Promise.resolve({ id: MEMBER_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name?: string };
    expect(body.name).toBe("Amara Okafor");
  });
});
