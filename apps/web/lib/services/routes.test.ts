import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { DELETE as bookingDetailDelete } from "@/app/api/bookings/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The booking DELETE handler calls requireSession(), which reads cookies() —
// unavailable outside a real request scope. Stub it so the handler runs.
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "sb-session",
  requireSession: vi.fn().mockResolvedValue({ email: "tester@example.com" }),
}));

// createNotificationProvider() would otherwise require RESEND_API_KEY; flip
// into fake-backends mode so it returns the in-memory recorder. Repositories are
// still injected via __setTestRepositories, which takes priority.
process.env.USE_FAKE_BACKENDS = "1";

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

describe("detail route handlers (cross-tenant IDOR)", () => {
  // Seed the caller's studio (s1, the demo studio from buildSeed) plus a
  // second studio's (s2) invoice, member, and session+booking. resolveStudio()
  // resolves to the first studio (s1), so s2 records are foreign to the caller.
  async function seedWithForeignTenant() {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const s1 = (await repos.studios.getFirst())?.id ?? "";

    await repos.members.insert({
      id: "m-foreign",
      studioId: "s2",
      name: "Foreign",
      email: "foreign@s2.co",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    await repos.invoices.insert({
      id: "inv-foreign",
      studioId: "s2",
      memberId: "m-foreign",
      number: "INV-s2-1",
      status: "open",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 1000,
      taxCents: 0,
      totalCents: 1000,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });
    await repos.classSessions.insert({
      id: "cs-foreign",
      studioId: "s2",
      classTypeId: (await repos.classTypes.listByStudio(s1))[0]?.id ?? "ct1",
      instructor: "X",
      startsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    await repos.bookings.insert({
      id: "b-foreign",
      sessionId: "cs-foreign",
      memberId: "m-foreign",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    __setTestRepositories(repos);
    return { s1 };
  }

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns 404 for a foreign invoice", async () => {
    await seedWithForeignTenant();
    const res = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/inv-foreign"),
      { params: Promise.resolve({ id: "inv-foreign" }) },
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/invoices/:id returns 200 for the caller's own invoice", async () => {
    await seedWithForeignTenant();
    const { resolveRepositories } = await import("@/lib/db/repos");
    const r = await resolveRepositories();
    const own = (await r.invoices.listByStudio((await r.studios.getFirst())!.id))[0];
    const res = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${own.id}`),
      { params: Promise.resolve({ id: own.id }) },
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/members/:id returns 404 for a foreign member", async () => {
    await seedWithForeignTenant();
    const res = await memberDetailGet(
      new NextRequest("http://localhost/api/members/m-foreign"),
      { params: Promise.resolve({ id: "m-foreign" }) },
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/members/:id returns 200 for the caller's own member", async () => {
    await seedWithForeignTenant();
    const { resolveRepositories } = await import("@/lib/db/repos");
    const r = await resolveRepositories();
    const own = (await r.members.listByStudio((await r.studios.getFirst())!.id))[0];
    const res = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${own.id}`),
      { params: Promise.resolve({ id: own.id }) },
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/bookings/:id returns 404 for a foreign booking and does not cancel it", async () => {
    await seedWithForeignTenant();
    const res = await bookingDetailDelete(
      new NextRequest("http://localhost/api/bookings/b-foreign", { method: "DELETE" }),
      { params: Promise.resolve({ id: "b-foreign" }) },
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
    const { resolveRepositories } = await import("@/lib/db/repos");
    const r = await resolveRepositories();
    expect((await r.bookings.getById("b-foreign"))?.status).toBe("booked");
  });

  it("DELETE /api/bookings/:id returns 200 for the caller's own booking", async () => {
    await seedWithForeignTenant();
    const { resolveRepositories } = await import("@/lib/db/repos");
    const r = await resolveRepositories();
    const s1 = (await r.studios.getFirst())!.id;
    const ct = (await r.classTypes.listByStudio(s1))[0];
    // cancelBooking compares session startsAt against the REAL clock, so the
    // session must be genuinely in the future — not just past the fixed seed NOW.
    const futureStart = new Date(Date.now() + 7 * 86_400_000);
    await r.classSessions.insert({
      id: "cs-own",
      studioId: s1,
      classTypeId: ct.id,
      instructor: "I",
      startsAt: futureStart.toISOString(),
      endsAt: new Date(futureStart.getTime() + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    await r.bookings.insert({
      id: "b-own",
      sessionId: "cs-own",
      memberId: (await r.members.listByStudio(s1))[0].id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    const res = await bookingDetailDelete(
      new NextRequest("http://localhost/api/bookings/b-own", { method: "DELETE" }),
      { params: Promise.resolve({ id: "b-own" }) },
    );
    expect(res.status).toBe(200);
  });
});
