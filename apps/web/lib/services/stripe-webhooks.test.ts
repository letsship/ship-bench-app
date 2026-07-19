import { describe, it, expect } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function createTestEvent(id: string, type: string, invoiceId: string | null = null): StripeEvent {
  return {
    id,
    type,
    data: {
      object: {
        metadata: invoiceId ? { invoice_id: invoiceId } : undefined,
      },
    },
  };
}

describe("processStripeEvent", () => {
  it("marks an open invoice as paid", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const openInvoice = seed.invoices.find((inv) => inv.status === "open");

    if (!openInvoice) throw new Error("No open invoice in seed data");

    const event = createTestEvent("evt_123", "invoice.paid", openInvoice.id);
    await processStripeEvent(repos, event);

    const updated = await repos.invoices.getById(openInvoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("idempotently handles duplicate events (already paid)", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const openInvoice = seed.invoices.find((inv) => inv.status === "open");

    if (!openInvoice) throw new Error("No open invoice in seed data");

    const event = createTestEvent("evt_123", "invoice.paid", openInvoice.id);

    // Process event first time
    await processStripeEvent(repos, event);
    const afterFirst = await repos.invoices.getById(openInvoice.id);
    const paidAtAfterFirst = afterFirst?.paidAt;

    // Add a small delay to ensure timestamp would differ
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Process same event again
    await processStripeEvent(repos, event);
    const afterSecond = await repos.invoices.getById(openInvoice.id);

    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAtAfterFirst);
  });

  it("ignores events for unknown invoices", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    const event = createTestEvent("evt_123", "invoice.paid", "unknown_id");
    await processStripeEvent(repos, event);

    // Should not throw and should not create anything
  });

  it("ignores non-invoice.paid events", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const openInvoice = seed.invoices.find((inv) => inv.status === "open");

    if (!openInvoice) throw new Error("No open invoice in seed data");

    const event = createTestEvent("evt_123", "customer.created", openInvoice.id);
    await processStripeEvent(repos, event);

    const unchanged = await repos.invoices.getById(openInvoice.id);
    expect(unchanged?.status).toBe("open");
    expect(unchanged?.paidAt).toBeNull();
  });

  it("ignores invoice.paid events without metadata", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const openInvoice = seed.invoices.find((inv) => inv.status === "open");

    if (!openInvoice) throw new Error("No open invoice in seed data");

    const event = createTestEvent("evt_123", "invoice.paid", null);
    await processStripeEvent(repos, event);

    const unchanged = await repos.invoices.getById(openInvoice.id);
    expect(unchanged?.status).toBe("open");
    expect(unchanged?.paidAt).toBeNull();
  });

  it("leaves already-paid invoices unchanged", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const paidInvoice = seed.invoices.find((inv) => inv.status === "paid");

    if (!paidInvoice) throw new Error("No paid invoice in seed data");

    const event = createTestEvent("evt_123", "invoice.paid", paidInvoice.id);
    await processStripeEvent(repos, event);

    const unchanged = await repos.invoices.getById(paidInvoice.id);
    expect(unchanged?.status).toBe("paid");
    expect(unchanged?.paidAt).toBe(paidInvoice.paidAt);
  });
});
