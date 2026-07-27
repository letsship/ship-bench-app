import { describe, expect, it } from "vitest";
import { processStripeEvent } from "./stripe-webhook";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed, SEED_NOW } from "@/lib/db/seed-data";

describe("processStripeEvent", () => {
  it("marks a matching invoice paid with paidAt", async () => {
    const repos = createInMemoryRepositories(buildSeed(SEED_NOW));
    const invoices = await repos.invoices.listByStudio((await repos.studios.getFirst())!.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");
    expect(openInvoice).toBeDefined();

    const event = {
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    };

    await processStripeEvent(repos, event);

    const updated = await repos.invoices.getById(openInvoice!.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("paid");
    expect(updated!.paidAt).toBeDefined();
    expect(updated!.paidAt).not.toBeNull();
  });

  it("replays the same event id and leaves invoice paid exactly once", async () => {
    const repos = createInMemoryRepositories(buildSeed(SEED_NOW));
    const invoices = await repos.invoices.listByStudio((await repos.studios.getFirst())!.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");
    expect(openInvoice).toBeDefined();

    const event = {
      id: "evt_test_2",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    };

    // First time
    await processStripeEvent(repos, event);
    const first = await repos.invoices.getById(openInvoice!.id);
    expect(first!.status).toBe("paid");
    const firstPaidAt = first!.paidAt;

    // Replay the same event
    await processStripeEvent(repos, event);
    const second = await repos.invoices.getById(openInvoice!.id);
    expect(second!.status).toBe("paid");
    expect(second!.paidAt).toBe(firstPaidAt);
  });

  it("ignores unknown invoice_id", async () => {
    const repos = createInMemoryRepositories(buildSeed(SEED_NOW));
    const studioId = (await repos.studios.getFirst())!.id;

    // Count initial paid invoices to verify no new ones are created
    const initialInvoices = await repos.invoices.listByStudio(studioId);
    const initialPaidCount = initialInvoices.filter((inv) => inv.status === "paid").length;

    const event = {
      id: "evt_test_3",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "unknown-invoice-id",
          },
        },
      },
    };

    await processStripeEvent(repos, event);

    const allInvoices = await repos.invoices.listByStudio(studioId);
    const finalPaidCount = allInvoices.filter((inv) => inv.status === "paid").length;
    expect(finalPaidCount).toBe(initialPaidCount);
  });

  it("ignores non-invoice.paid event types", async () => {
    const repos = createInMemoryRepositories(buildSeed(SEED_NOW));
    const studioId = (await repos.studios.getFirst())!.id;

    // Count initial open invoices to verify none are changed to paid
    const initialInvoices = await repos.invoices.listByStudio(studioId);
    const initialOpenCount = initialInvoices.filter((inv) => inv.status === "open").length;

    const event = {
      id: "evt_test_4",
      type: "invoice.created",
      data: {
        object: {
          metadata: {
            invoice_id: "any-id",
          },
        },
      },
    };

    await processStripeEvent(repos, event);

    const allInvoices = await repos.invoices.listByStudio(studioId);
    const finalOpenCount = allInvoices.filter((inv) => inv.status === "open").length;
    expect(finalOpenCount).toBe(initialOpenCount);
  });

  it("records the webhook event id", async () => {
    const repos = createInMemoryRepositories(buildSeed(SEED_NOW));
    const eventId = "evt_test_5";

    const beforeRecord = await repos.webhookEvents.has(eventId);
    expect(beforeRecord).toBe(false);

    const event = {
      id: eventId,
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "unknown-id",
          },
        },
      },
    };

    await processStripeEvent(repos, event);

    const afterRecord = await repos.webhookEvents.has(eventId);
    expect(afterRecord).toBe(true);
  });
});
