import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceDetailGet, PATCH as invoicePatch } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberDetailGet, PATCH as memberPatch } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { startSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// Next 16 makes cookies() async; back it with a plain jar so the real
// HMAC-signed session round-trip (startSession → requireSession) still runs.
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

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

describe("[id] route handlers await Next 16 async params", () => {
  // Seed relative to the real clock so booking-cancellation windows (which
  // compare session start times against now) fall in the future.
  let seed: ReturnType<typeof buildSeed>;

  beforeEach(() => {
    seed = buildSeed(new Date());
    __setTestRepositories(createInMemoryRepositories(seed));
    cookieJar.clear();
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("GET /api/invoices/:id returns the invoice detail", async () => {
    const invoice = seed.invoices[0];
    const res = await invoiceDetailGet(new Request("http://localhost"), params(invoice.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string }; lineItems: unknown[] };
    expect(body.invoice.id).toBe(invoice.id);
    expect(body.lineItems.length).toBeGreaterThan(0);
  });

  it("GET /api/invoices/:id 404s for an unknown id", async () => {
    const res = await invoiceDetailGet(new Request("http://localhost"), params("missing"));
    expect(res.status).toBe(404);
  });

  it("PATCH /api/invoices/:id advances the status for a signed-in operator", async () => {
    await startSession("operator@riverbank.studio");
    const draft = seed.invoices.find((invoice) => invoice.status === "draft");
    if (!draft) throw new Error("seed has no draft invoice");
    const res = await invoicePatch(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      }),
      params(draft.id),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("open");
  });

  it("PATCH /api/invoices/:id rejects an anonymous request", async () => {
    const res = await invoicePatch(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      }),
      params(seed.invoices[0].id),
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/members/:id returns the member", async () => {
    const member = seed.members[0];
    const res = await memberDetailGet(new Request("http://localhost"), params(member.id));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { email: string }).email).toBe(member.email);
  });

  it("PATCH /api/members/:id updates the member for a signed-in operator", async () => {
    await startSession("operator@riverbank.studio");
    const member = seed.members[0];
    const res = await memberPatch(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      params(member.id),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Renamed");
  });

  it("DELETE /api/bookings/:id cancels a future booking for a signed-in operator", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    await startSession("operator@riverbank.studio");
    const cutoff = Date.now() + 24 * 60 * 60 * 1000;
    const futureSessionIds = new Set(
      seed.sessions.filter((s) => new Date(s.startsAt).getTime() > cutoff).map((s) => s.id),
    );
    const booking = seed.bookings.find(
      (b) => b.status === "booked" && futureSessionIds.has(b.sessionId),
    );
    if (!booking) throw new Error("seed has no future booked booking");
    const res = await bookingDelete(new Request("http://localhost"), params(booking.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { refundEligible: boolean };
    expect(typeof body.refundEligible).toBe("boolean");
  });
});
