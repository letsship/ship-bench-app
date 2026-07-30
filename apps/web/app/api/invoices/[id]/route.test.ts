import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice } from "@/lib/db/types";
import { buildSeed } from "@/lib/db/seed-data";

// Next 16 made the dynamic request APIs asynchronous. This mock mirrors that
// contract: cookies() resolves to the store rather than being the store, so a
// handler that forgets to await it reads `undefined` and fails here.
const cookieJar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}));

const { GET, PATCH } = await import("./route");
const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth/session");

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Pick a seeded invoice by status so the PATCH exercises a legal transition.
function seedInvoice(status: string): Invoice {
  const invoice = buildSeed(NOW).invoices.find((candidate) => candidate.status === status);
  if (!invoice) throw new Error(`Seed has no ${status} invoice`);
  return invoice;
}

describe("/api/invoices/[id] with Next 16 async params", () => {
  beforeEach(async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    cookieJar.set(SESSION_COOKIE, await createSessionToken("operator@riverbank.studio"));
  });
  afterEach(() => {
    __setTestRepositories(null);
    cookieJar.clear();
  });

  it("GET awaits params and returns the invoice detail", async () => {
    const { id, number } = seedInvoice("draft");

    const res = await GET(new Request(`http://localhost/api/invoices/${id}`), {
      params: Promise.resolve({ id }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: Invoice; lineItems: unknown[] };
    expect(body.invoice.id).toBe(id);
    expect(body.invoice.number).toBe(number);
    expect(body.lineItems.length).toBeGreaterThan(0);
  });

  it("GET awaits params before deciding an unknown id is missing", async () => {
    const res = await GET(new Request("http://localhost/api/invoices/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(res.status).toBe(404);
  });

  it("PATCH awaits params and advances the invoice status", async () => {
    const { id } = seedInvoice("draft");

    const res = await PATCH(
      new Request(`http://localhost/api/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, status: "open" });
  });

  it("PATCH rejects an illegal transition for the awaited id", async () => {
    const { id } = seedInvoice("paid");

    const res = await PATCH(
      new Request(`http://localhost/api/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "draft" }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(409);
  });
});
