import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeWebhookEventInput } from "@/lib/validation";
import { processStripeEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

const invoicePaidEvent = (id: string, invoiceId: string): StripeWebhookEventInput => ({
  id,
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: invoiceId } } },
});

describe("processStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    openInvoiceId = invoices.find((invoice) => invoice.status === "open")?.id ?? "";
  });

  it("marks the referenced invoice paid and records the event", async () => {
    const outcome = await processStripeEvent(repos, invoicePaidEvent("evt_1", openInvoiceId));

    expect(outcome).toEqual({ handled: true, duplicate: false, invoiceId: openInvoiceId });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();
    expect(await repos.webhookEvents.has("evt_1")).toBe(true);
  });

  it("is idempotent: the same event id is processed exactly once", async () => {
    const event = invoicePaidEvent("evt_1", openInvoiceId);
    await processStripeEvent(repos, event);
    const paidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;

    const replay = await processStripeEvent(repos, event);

    expect(replay).toEqual({ handled: false, duplicate: true, invoiceId: null });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(paidAt);
  });

  it("acknowledges an event naming an unknown invoice without changing anything", async () => {
    const outcome = await processStripeEvent(
      repos,
      invoicePaidEvent("evt_2", "inv_does_not_exist"),
    );

    expect(outcome.handled).toBe(false);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(await repos.webhookEvents.has("evt_2")).toBe(true);
  });

  it("acknowledges an event of another type without changing anything", async () => {
    const outcome = await processStripeEvent(repos, {
      id: "evt_3",
      type: "customer.subscription.created",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });

    expect(outcome.handled).toBe(false);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
    expect(await repos.webhookEvents.has("evt_3")).toBe(true);
  });

  it("leaves an invoice that cannot transition to paid untouched", async () => {
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    const draft = invoices.find((invoice) => invoice.status === "draft");

    const outcome = await processStripeEvent(repos, invoicePaidEvent("evt_4", draft?.id ?? ""));

    expect(outcome.handled).toBe(false);
    expect((await repos.invoices.getById(draft?.id ?? ""))?.status).toBe("draft");
  });
});
