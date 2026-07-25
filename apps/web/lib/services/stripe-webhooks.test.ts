import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { processStripeEvent } from "./stripe-webhooks";
import type { StripeWebhookEvent } from "@/lib/validation";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("processStripeEvent", () => {
  it("marks an open invoice paid on invoice.paid event", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await repos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });

    const event: StripeWebhookEvent = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: invoice.id },
        },
      },
    };

    const result = await processStripeEvent(repos, event);
    expect(result.handled).toBe(true);

    const updated = await repos.invoices.getById(invoice.id);
    if (!updated) throw new Error("Invoice not found");
    expect(updated.status).toBe("paid");
    expect(updated.paidAt).not.toBeNull();
  });

  it("is idempotent on repeat invoice.paid event", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await repos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0002",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });

    const event: StripeWebhookEvent = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: invoice.id },
        },
      },
    };

    const result1 = await processStripeEvent(repos, event);
    expect(result1.handled).toBe(true);

    const afterFirst = await repos.invoices.getById(invoice.id);
    if (!afterFirst) throw new Error("Invoice not found");
    const paidAtFirst = afterFirst.paidAt;

    const result2 = await processStripeEvent(repos, event);
    expect(result2.handled).toBe(false);

    const afterSecond = await repos.invoices.getById(invoice.id);
    if (!afterSecond) throw new Error("Invoice not found");
    expect(afterSecond.status).toBe("paid");
    expect(afterSecond.paidAt).toBe(paidAtFirst);
  });

  it("changes nothing for an unknown invoice id", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoices = await repos.invoices.listByStudio("studio-1");
    const initialCount = invoices.filter((inv) => inv.status === "paid").length;

    const event: StripeWebhookEvent = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "unknown-id" },
        },
      },
    };

    const result = await processStripeEvent(repos, event);
    expect(result.handled).toBe(false);

    const afterEvent = await repos.invoices.listByStudio("studio-1");
    const finalCount = afterEvent.filter((inv) => inv.status === "paid").length;
    expect(finalCount).toBe(initialCount);
  });

  it("changes nothing for an already-paid invoice", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const originalPaidAt = NOW.toISOString();
    const invoice = await repos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0003",
      status: "paid",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: originalPaidAt,
      createdAt: NOW.toISOString(),
    });

    const event: StripeWebhookEvent = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: invoice.id },
        },
      },
    };

    const result = await processStripeEvent(repos, event);
    expect(result.handled).toBe(false);

    const unchanged = await repos.invoices.getById(invoice.id);
    if (!unchanged) throw new Error("Invoice not found");
    expect(unchanged.status).toBe("paid");
    expect(unchanged.paidAt).toBe(originalPaidAt);
  });

  it("changes nothing for a non-invoice.paid event", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await repos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0004",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });

    const event: StripeWebhookEvent = {
      id: "evt_1",
      type: "customer.created",
      data: {
        object: {
          metadata: { invoice_id: invoice.id },
        },
      },
    };

    const result = await processStripeEvent(repos, event);
    expect(result.handled).toBe(false);

    const unchanged = await repos.invoices.getById(invoice.id);
    if (!unchanged) throw new Error("Invoice not found");
    expect(unchanged.status).toBe("open");
    expect(unchanged.paidAt).toBeNull();
  });

  it("changes nothing when invoice_id is missing from metadata", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await repos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0005",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });

    const event: StripeWebhookEvent = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {},
        },
      },
    };

    const result = await processStripeEvent(repos, event);
    expect(result.handled).toBe(false);

    const unchanged = await repos.invoices.getById(invoice.id);
    if (!unchanged) throw new Error("Invoice not found");
    expect(unchanged.status).toBe("open");
  });
});
