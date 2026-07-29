import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Invoice } from "@/lib/db/types";
import { handleStripeEvent } from "./webhooks";
import type { StripeEvent } from "@/lib/validation";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return { ...buildSeed(NOW), ...over };
}

function invoice(id: string, status: string, paidAt: string | null = null): Invoice {
  return {
    id,
    studioId: "s1",
    memberId: "m1",
    number: `INV-${id}`,
    status,
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: 1000,
    taxCents: 90,
    totalCents: 1090,
    issuedAt: NOW.toISOString(),
    dueAt: null,
    paidAt,
    createdAt: NOW.toISOString(),
  };
}

function paidEvent(invoiceId: string, eventId = "evt_001"): StripeEvent {
  return {
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  } as StripeEvent;
}

describe("handleStripeEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({ invoices: [invoice("inv_open", "open"), invoice("inv_paid", "paid", NOW.toISOString())] }),
    );
  });

  it("marks the named invoice paid on invoice.paid", async () => {
    await handleStripeEvent(repos, paidEvent("inv_open"));
    const invoice = await repos.invoices.getById("inv_open");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event id does not double-process", async () => {
    await handleStripeEvent(repos, paidEvent("inv_open", "evt_dup"));
    const first = await repos.invoices.getById("inv_open");
    const firstPaidAt = first?.paidAt;
    expect(first?.status).toBe("paid");

    await handleStripeEvent(repos, paidEvent("inv_open", "evt_dup"));
    const second = await repos.invoices.getById("inv_open");
    expect(second?.status).toBe("paid");
    expect(second?.paidAt).toBe(firstPaidAt);
  });

  it("does not touch an invoice that is already paid", async () => {
    const before = await repos.invoices.getById("inv_paid");
    await handleStripeEvent(repos, paidEvent("inv_paid", "evt_already"));
    const after = await repos.invoices.getById("inv_paid");
    expect(after?.paidAt).toBe(before?.paidAt);
  });

  it("acknowledges an unknown invoice id without error (and records the event)", async () => {
    await expect(handleStripeEvent(repos, paidEvent("inv_missing", "evt_unknown"))).resolves.toBeUndefined();
    const recorded = await repos.webhookEvents.getById("evt_unknown");
    expect(recorded).not.toBeNull();
  });

  it("records but does not act on a non-invoice.paid event", async () => {
    const other = {
      id: "evt_other",
      type: "charge.refunded",
      data: { object: { metadata: {} } },
    } as StripeEvent;
    await handleStripeEvent(repos, other);
    expect(await repos.webhookEvents.getById("evt_other")).not.toBeNull();
    const open = await repos.invoices.getById("inv_open");
    expect(open?.status).toBe("open");
  });
});
