import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { processStripeWebhook } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function paidEvent(invoiceId: string) {
  return {
    id: "evt_invoice_paid",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  } as const;
}

describe("processStripeWebhook", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  let invoiceId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    invoiceId = seed.invoices.find((invoice) => invoice.status === "open")!.id;
  });

  it("marks the named invoice paid", async () => {
    await processStripeWebhook(repos, paidEvent(invoiceId));
    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toEqual(expect.any(String));
  });

  it("is idempotent for repeated delivery", async () => {
    const event = paidEvent(invoiceId);
    await processStripeWebhook(repos, event);
    const firstPaidAt = (await repos.invoices.getById(invoiceId))?.paidAt;
    await processStripeWebhook(repos, event);
    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("ignores an unknown invoice", async () => {
    await processStripeWebhook(repos, paidEvent("missing-invoice"));
    expect((await repos.invoices.listByStudio((await repos.studios.getFirst())!.id)).length).toBe(
      buildSeed(NOW).invoices.length,
    );
  });

  it("ignores other event types", async () => {
    await processStripeWebhook(repos, {
      id: "evt_other",
      type: "payment_intent.succeeded",
      data: { object: {} },
    });
    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
