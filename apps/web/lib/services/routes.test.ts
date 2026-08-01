import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "operator@riverbank.studio" })),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
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

  it("GET /api/members/:id awaits the route params", async () => {
    const member = buildSeed(NOW).members[0];
    const res = await memberGet(new Request(`http://localhost/api/members/${member.id}`), {
      params: Promise.resolve({ id: member.id }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: member.id, email: member.email });
  });

  it("GET /api/invoices/:id awaits the route params", async () => {
    const invoice = buildSeed(NOW).invoices[0];
    const res = await invoiceGet(new Request(`http://localhost/api/invoices/${invoice.id}`), {
      params: Promise.resolve({ id: invoice.id }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ invoice: { id: invoice.id } });
  });

  it("DELETE /api/bookings/:id awaits the route params", async () => {
    const seed = buildSeed(new Date("2099-03-15T12:00:00.000Z"));
    const booking = seed.bookings.find((entry) => entry.status === "booked");
    expect(booking).toBeDefined();
    if (!booking) throw new Error("Expected a booked seed booking");

    __setTestRepositories(createInMemoryRepositories(seed));
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const res = await bookingDelete(
      new Request(`http://localhost/api/bookings/${booking.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: booking.id }) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      refundEligible: unknown;
      promotedMemberId: unknown;
    };
    expect(typeof body.refundEligible).toBe("boolean");
    expect(body.promotedMemberId === null || typeof body.promotedMemberId === "string").toBe(true);
  });
});
