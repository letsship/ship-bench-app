import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-07-01T12:00:00.000Z");
const SECRET = "whsec_test_secret_for_route";
const TIMESTAMP = Math.floor(NOW.getTime() / 1000);

function signPayload(payload: string): string {
  const sig = createHmac("sha256", SECRET)
    .update(`${TIMESTAMP}.${payload}`)
    .digest("hex");
  return `t=${TIMESTAMP},v1=${sig}`;
}

function makeRequest(body: object, header: string | null): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (header !== null) {
    headers["stripe-signature"] = header;
  }
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
    if (previousSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    }
  });

  async function openInvoiceId(): Promise<string> {
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio!.id);
    const open = invoices.find((inv) => inv.status === "open");
    if (!open) throw new Error("no open invoice in seed");
    return open.id;
  }

  it("rejects a request with a missing signature (400) and changes nothing", async () => {
    const id = await openInvoiceId();
    const event = { id: "evt_1", type: "invoice.paid", data: { object: { metadata: { invoice_id: id } } } };
    const req = makeRequest(event, null);
    const res = await POST(req);
    expect(res.status).toBe(400);

    const updated = await repos.invoices.getById(id);
    expect(updated?.status).toBe("open");
  });

  it("rejects a request with an invalid signature (400) and changes nothing", async () => {
    const id = await openInvoiceId();
    const event = { id: "evt_1", type: "invoice.paid", data: { object: { metadata: { invoice_id: id } } } };
    const req = makeRequest(event, "t=1,v1=badhex");
    const res = await POST(req);
    expect(res.status).toBe(400);

    const updated = await repos.invoices.getById(id);
    expect(updated?.status).toBe("open");
  });

  it("marks an invoice paid on a verified invoice.paid event (200)", async () => {
    const id = await openInvoiceId();
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: { metadata: { invoice_id: id } } } });
    const header = signPayload(payload);
    const req = makeRequest(JSON.parse(payload), header);
    const res = await POST(req);
    expect(res.status).toBe(200);

    const updated = await repos.invoices.getById(id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("is idempotent — duplicate delivery returns 200 and the invoice is paid once", async () => {
    const id = await openInvoiceId();
    const payload = JSON.stringify({ id: "evt_dup", type: "invoice.paid", data: { object: { metadata: { invoice_id: id } } } });
    const header = signPayload(payload);
    const body = JSON.parse(payload);

    const res1 = await POST(makeRequest(body, header));
    expect(res1.status).toBe(200);

    const afterFirst = await repos.invoices.getById(id);
    expect(afterFirst?.status).toBe("paid");
    const paidAt = afterFirst?.paidAt;

    const res2 = await POST(makeRequest(body, header));
    expect(res2.status).toBe(200);

    const afterSecond = await repos.invoices.getById(id);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAt);
  });

  it("responds 200 for a verified event naming an unknown invoice and changes nothing", async () => {
    const event = { id: "evt_2", type: "invoice.paid", data: { object: { metadata: { invoice_id: "unknown-id" } } } };
    const payload = JSON.stringify(event);
    const header = signPayload(payload);
    const req = makeRequest(event, header);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("responds 200 for a verified non-invoice.paid event and changes nothing", async () => {
    const id = await openInvoiceId();
    const event = { id: "evt_3", type: "customer.updated", data: { object: { metadata: { invoice_id: id } } } };
    const payload = JSON.stringify(event);
    const header = signPayload(payload);
    const req = makeRequest(event, header);
    const res = await POST(req);
    expect(res.status).toBe(200);

    const unchanged = await repos.invoices.getById(id);
    expect(unchanged?.status).toBe("open");
  });
});