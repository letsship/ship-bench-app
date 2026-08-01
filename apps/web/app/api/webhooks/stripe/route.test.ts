import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { computeStripeSignature } from "@/lib/stripe/webhook";
import { POST } from "./route";

const SECRET = "whsec_route_test";
const TIMESTAMP = "1712000000";
const NOW = new Date("2026-03-15T12:00:00.000Z");

async function signedRequest(body: string, header?: string): Promise<NextRequest> {
  const signature =
    header ?? `t=${TIMESTAMP},v1=${await computeStripeSignature(body, TIMESTAMP, SECRET)}`;
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const seed = buildSeed(NOW);
    openInvoiceId = seed.invoices.find((row) => row.status === "open")!.id;
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    __setTestRepositories(null);
  });

  const paidBody = () =>
    JSON.stringify({
      id: "evt_route_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });

  it("marks the invoice paid on a correctly signed invoice.paid event", async () => {
    const res = await POST(await signedRequest(paidBody()));
    expect(res.status).toBe(200);
    const updated = await repos.invoices.getById(openInvoiceId);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBeTruthy();
  });

  it("rejects a missing signature with 400 and changes nothing", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: paidBody(),
      }),
    );
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const res = await POST(await signedRequest(paidBody(), `t=${TIMESTAMP},v1=${"0".repeat(64)}`));
    expect(res.status).toBe(400);
    const untouched = await repos.invoices.getById(openInvoiceId);
    expect(untouched?.status).toBe("open");
    expect(untouched?.paidAt).toBeNull();
  });

  it("handles a duplicate delivery: 200 twice, invoice paid exactly once", async () => {
    const first = await POST(await signedRequest(paidBody()));
    expect(first.status).toBe(200);
    const afterFirst = await repos.invoices.getById(openInvoiceId);

    const second = await POST(await signedRequest(paidBody()));
    expect(second.status).toBe(200);
    expect((await second.json()) as Record<string, unknown>).toMatchObject({ duplicate: true });
    expect(await repos.invoices.getById(openInvoiceId)).toEqual(afterFirst);
  });

  it("acknowledges a verified event of another type without changing anything", async () => {
    const body = JSON.stringify({ id: "evt_route_2", type: "payment_intent.created" });
    const res = await POST(await signedRequest(body));
    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });
});
