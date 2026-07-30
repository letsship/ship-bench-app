import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";
import { processStripeEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const PAID_AT = "2026-03-15T12:00:00.000Z";

const invoicePaid = (eventId: string, invoiceId: string): StripeEvent => ({
  id: eventId,
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: invoiceId } } },
});

describe("processStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    const open = seed.invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("seed has no open invoice");
    openInvoiceId = open.id;
  });

  it("marks the invoice named in the event paid", async () => {
    const result = await processStripeEvent(repos, invoicePaid("evt_1", openInvoiceId), PAID_AT);

    expect(result).toEqual({ eventId: "evt_1", outcome: "processed" });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(PAID_AT);
  });

  it("records the event id so the delivery can be recognised again", async () => {
    await processStripeEvent(repos, invoicePaid("evt_1", openInvoiceId), PAID_AT);
    expect(await repos.processedStripeEvents.getById("evt_1")).toEqual({
      id: "evt_1",
      receivedAt: PAID_AT,
    });
  });

  it("is idempotent: the same event id twice leaves the invoice paid exactly once", async () => {
    const event = invoicePaid("evt_1", openInvoiceId);
    await processStripeEvent(repos, event, PAID_AT);
    const second = await processStripeEvent(repos, event, "2026-03-16T09:00:00.000Z");

    expect(second).toEqual({ eventId: "evt_1", outcome: "duplicate" });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    // Still the FIRST payment time — the replay did not re-run the update.
    expect(invoice?.paidAt).toBe(PAID_AT);
  });

  it("does not double-process a redelivery of an invoice paid by another route", async () => {
    // A distinct event for an invoice that is already paid: the domain forbids
    // paid→paid, so nothing changes and no error escapes.
    await processStripeEvent(repos, invoicePaid("evt_1", openInvoiceId), PAID_AT);
    const result = await processStripeEvent(
      repos,
      invoicePaid("evt_2", openInvoiceId),
      "2026-03-17T09:00:00.000Z",
    );

    expect(result).toEqual({ eventId: "evt_2", outcome: "already_paid" });
    expect((await repos.invoices.getById(openInvoiceId))?.paidAt).toBe(PAID_AT);
  });

  it("acknowledges an event naming an unknown invoice and changes nothing", async () => {
    const before = await repos.invoices.listByStudio((await repos.studios.getFirst())!.id);
    const result = await processStripeEvent(repos, invoicePaid("evt_9", "inv_missing"), PAID_AT);

    expect(result).toEqual({ eventId: "evt_9", outcome: "unknown_invoice" });
    expect(await repos.invoices.listByStudio((await repos.studios.getFirst())!.id)).toEqual(before);
  });

  it("acknowledges an invoice.paid event with no invoice_id metadata", async () => {
    const result = await processStripeEvent(
      repos,
      { id: "evt_10", type: "invoice.paid", data: { object: {} } },
      PAID_AT,
    );
    expect(result).toEqual({ eventId: "evt_10", outcome: "unknown_invoice" });
  });

  it("ignores an event of any other type", async () => {
    const result = await processStripeEvent(
      repos,
      { ...invoicePaid("evt_3", openInvoiceId), type: "payment_intent.succeeded" },
      PAID_AT,
    );

    expect(result).toEqual({ eventId: "evt_3", outcome: "ignored_type" });
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });
});
