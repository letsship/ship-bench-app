import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/validation";
import { handleStripeEvent } from "./stripe-webhooks";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function openInvoiceId(repos: Repositories): Promise<string> {
  return repos.studios.getFirst().then((studio) =>
    repos.invoices.listByStudio(studio!.id).then((invoices) => {
      const open = invoices.find((inv) => inv.status === "open");
      if (!open) throw new Error("no open invoice in seed");
      return open.id;
    }),
  );
}

function paidInvoiceId(repos: Repositories): Promise<string> {
  return repos.studios.getFirst().then((studio) =>
    repos.invoices.listByStudio(studio!.id).then((invoices) => {
      const paid = invoices.find((inv) => inv.status === "paid");
      if (!paid) throw new Error("no paid invoice in seed");
      return paid.id;
    }),
  );
}

describe("handleStripeEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
  });

  it("marks an open invoice as paid on invoice.paid event", async () => {
    const id = await openInvoiceId(repos);
    const event: StripeEvent = {
      id: "evt_test_001",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: id } } },
    };
    await handleStripeEvent(repos, event);
    const updated = await repos.invoices.getById(id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("is idempotent — replaying the same event does not double-process", async () => {
    const id = await openInvoiceId(repos);
    const event: StripeEvent = {
      id: "evt_test_001",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: id } } },
    };
    await handleStripeEvent(repos, event);
    const afterFirst = await repos.invoices.getById(id);
    expect(afterFirst?.status).toBe("paid");
    const paidAt = afterFirst?.paidAt;

    await handleStripeEvent(repos, event);
    const afterSecond = await repos.invoices.getById(id);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAt);
  });

  it("acknowledges an event naming an unknown invoice and changes nothing", async () => {
    const event: StripeEvent = {
      id: "evt_test_002",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "nonexistent-id" } } },
    };
    await expect(handleStripeEvent(repos, event)).resolves.toBeUndefined();
  });

  it("acknowledges non-invoice.paid events and changes nothing", async () => {
    const id = await openInvoiceId(repos);
    const event: StripeEvent = {
      id: "evt_test_003",
      type: "customer.updated",
      data: { object: { metadata: { invoice_id: id } } },
    };
    await handleStripeEvent(repos, event);
    const unchanged = await repos.invoices.getById(id);
    expect(unchanged?.status).toBe("open");
  });

  it("does not change an already-paid invoice", async () => {
    const id = await paidInvoiceId(repos);
    const event: StripeEvent = {
      id: "evt_test_004",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: id } } },
    };
    await handleStripeEvent(repos, event);
    const unchanged = await repos.invoices.getById(id);
    expect(unchanged?.status).toBe("paid");
  });

  it("acknowledges invoice.paid with no metadata and changes nothing", async () => {
    const event: StripeEvent = {
      id: "evt_test_005",
      type: "invoice.paid",
      data: { object: {} },
    };
    await expect(handleStripeEvent(repos, event)).resolves.toBeUndefined();
  });

  it("acknowledges invoice.paid with metadata but no invoice_id and changes nothing", async () => {
    const event: StripeEvent = {
      id: "evt_test_006",
      type: "invoice.paid",
      data: { object: { metadata: {} } },
    };
    await expect(handleStripeEvent(repos, event)).resolves.toBeUndefined();
  });
});