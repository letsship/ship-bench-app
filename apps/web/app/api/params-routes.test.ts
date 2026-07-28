import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/[id]/route";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Next 16 makes `cookies()` async and request-scoped. Under Vitest there is no
// request context, so stub `next/headers` with an in-memory cookie store. The
// store is populated with a valid dev session token so the authenticated
// bookings DELETE handler can run.
const cookieStore = {
  values: new Map<string, string>(),
  get(name: string) {
    return this.values.has(name) ? { name, value: this.values.get(name)! } : undefined;
  },
  getAll() {
    return Array.from(this.values, ([name, value]) => ({ name, value }));
  },
  set(name: string, value: string) {
    this.values.set(name, value);
  },
  delete(name: string) {
    this.values.delete(name);
  },
};

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

let repos: Repositories;

describe("[id] route handlers (Next 16 Promise params)", () => {
  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    cookieStore.values.clear();
    cookieStore.set(SESSION_COOKIE, await createSessionToken("operator@riverbank.studio"));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id awaits Promise params and returns the invoice detail", async () => {
    const studio = await repos.studios.getFirst();
    const [invoice] = await repos.invoices.listByStudio(studio!.id);

    const res = await invoicesGet(new Request("http://localhost"), {
      params: Promise.resolve({ id: invoice.id }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string }; member: { id: string } };
    expect(body.invoice.id).toBe(invoice.id);
  });

  it("GET /api/invoices/:id returns 404 for an unknown id", async () => {
    const res = await invoicesGet(new Request("http://localhost"), {
      params: Promise.resolve({ id: "no-such-invoice" }),
    });

    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id awaits Promise params and returns the member", async () => {
    const studio = await repos.studios.getFirst();
    const [member] = await repos.members.listByStudio(studio!.id);

    const res = await membersGet(new Request("http://localhost"), {
      params: Promise.resolve({ id: member.id }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.id).toBe(member.id);
  });

  it("DELETE /api/bookings/:id awaits Promise params and reports 404 for an unknown booking", async () => {
    // The fake provider keeps the handler hermetic (no Resend key required).
    const previous = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    try {
      const res = await bookingsDelete(new Request("http://localhost"), {
        params: Promise.resolve({ id: "no-such-booking" }),
      });

      expect(res.status).toBe(404);
    } finally {
      if (previous === undefined) delete process.env.USE_FAKE_BACKENDS;
      else process.env.USE_FAKE_BACKENDS = previous;
    }
  });
});
