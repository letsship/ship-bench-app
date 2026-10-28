import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { processStripeEvent } from "./stripe-webhooks";
import { buildSeed } from "@/lib/db/seed-data";

describe("processStripeEvent", () => {
  let repos = createInMemoryRepositories(buildSeed());

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed());
  });

  it("marks invoice paid on invoice.paid event", async () => {
    const invoice = (await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001"))[0]!;
    const event = {
      id: "evt_test_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    };

    await processStripeEvent(repos, event);

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBeTruthy();

    const recorded = await repos.webhookEvents.getById(event.id);
    expect(recorded?.id).toBe(event.id);
    expect(recorded?.type).toBe("invoice.paid");
  });

  it("is idempotent: redelivery does not double-process", async () => {
    const invoice = (await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001"))[0]!;
    const eventId = "evt_test_idempotent";
    const event = {
      id: eventId,
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    };

    await processStripeEvent(repos, event);
    const firstPaidAt = (await repos.invoices.getById(invoice.id))?.paidAt;

    await new Promise((resolve) => setTimeout(resolve, 10));

    await processStripeEvent(repos, event);
    const secondPaidAt = (await repos.invoices.getById(invoice.id))?.paidAt;

    expect(firstPaidAt).toBe(secondPaidAt);
    const recorded = await repos.webhookEvents.getById(eventId);
    expect(recorded).toBeTruthy();
  });

  it("acknowledges unknown invoice without changing anything", async () => {
    const event = {
      id: "evt_test_unknown",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "unknown_invoice_id" } } },
    };

    const invoicesCountBefore = (
      await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001")
    ).length;

    await processStripeEvent(repos, event);

    const invoicesCountAfter = (
      await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001")
    ).length;
    expect(invoicesCountAfter).toBe(invoicesCountBefore);

    const recorded = await repos.webhookEvents.getById(event.id);
    expect(recorded?.id).toBe(event.id);
  });

  it("acknowledges non-invoice.paid events without changing anything", async () => {
    const event = {
      id: "evt_test_other_type",
      type: "customer.created",
      data: { object: { metadata: {} } },
    };

    const invoicesCountBefore = (
      await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001")
    ).length;

    await processStripeEvent(repos, event);

    const invoicesCountAfter = (
      await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001")
    ).length;
    expect(invoicesCountAfter).toBe(invoicesCountBefore);

    const recorded = await repos.webhookEvents.getById(event.id);
    expect(recorded?.id).toBe(event.id);
    expect(recorded?.type).toBe("customer.created");
  });

  it("handles invoice.paid with missing invoice_id metadata", async () => {
    const event = {
      id: "evt_test_no_metadata",
      type: "invoice.paid",
      data: { object: { metadata: {} } },
    };

    const invoicesCountBefore = (
      await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001")
    ).length;

    await processStripeEvent(repos, event);

    const invoicesCountAfter = (
      await repos.invoices.listByStudio("00000000-0000-4000-8000-000000000001")
    ).length;
    expect(invoicesCountAfter).toBe(invoicesCountBefore);

    const recorded = await repos.webhookEvents.getById(event.id);
    expect(recorded?.id).toBe(event.id);
  });

  it("does not call updateInvoiceStatus (leaves transition guards alone)", async () => {
    const seed = buildSeed();
    const invoice = seed.invoices.find((i) => i.status === "paid")!;
    seed.invoices = [invoice];
    const testRepos = createInMemoryRepositories(seed);

    const event = {
      id: "evt_test_already_paid",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    };

    await processStripeEvent(testRepos, event);

    const recorded = await testRepos.webhookEvents.getById(event.id);
    expect(recorded?.id).toBe(event.id);

    const updated = await testRepos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
  });
});
