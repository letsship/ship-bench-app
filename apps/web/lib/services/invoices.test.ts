import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/local-db";
import { setupScenario, testProvider } from "@/lib/test-support";
import { createInvoice, getInvoiceDetail, updateInvoiceStatus } from "./invoices";

describe("invoices service", () => {
  it("computes totals and sends an invoice notification", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { taxRateBps: 900 });
    const { provider, transport } = testProvider();
    const detail = await createInvoice(db, provider, scenario.studioId, {
      memberId: scenario.memberA,
      lineItems: [{ description: "5-class pass", quantity: 2, unitAmountCents: 1000 }],
    });
    expect(detail.invoice.subtotalCents).toBe(2000);
    expect(detail.invoice.taxCents).toBe(180);
    expect(detail.invoice.totalCents).toBe(2180);
    expect(detail.invoice.number).toMatch(/^INV-\d{4}-0001$/);
    expect(detail.lineItems).toHaveLength(1);
    expect(detail.lineItems[0].amountCents).toBe(2000);
    expect(transport.sent[0].tags).toEqual(["invoice_issued"]);
  });

  it("advances a valid status transition", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db);
    const { provider } = testProvider();
    const detail = await createInvoice(db, provider, scenario.studioId, {
      memberId: scenario.memberA,
      lineItems: [{ description: "Drop-in", quantity: 1, unitAmountCents: 1800 }],
    });
    const paid = await updateInvoiceStatus(db, detail.invoice.id, "paid");
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).not.toBeNull();
  });

  it("rejects an invalid status transition", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db);
    const { provider } = testProvider();
    const detail = await createInvoice(db, provider, scenario.studioId, {
      memberId: scenario.memberA,
      lineItems: [{ description: "Drop-in", quantity: 1, unitAmountCents: 1800 }],
    });
    await updateInvoiceStatus(db, detail.invoice.id, "paid");
    await expect(updateInvoiceStatus(db, detail.invoice.id, "draft")).rejects.toMatchObject({
      status: 409,
      code: "invalid_transition",
    });
  });

  it("returns invoice detail with member and line items", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db);
    const { provider } = testProvider();
    const created = await createInvoice(db, provider, scenario.studioId, {
      memberId: scenario.memberA,
      lineItems: [{ description: "Drop-in", quantity: 1, unitAmountCents: 1800 }],
    });
    const detail = await getInvoiceDetail(db, created.invoice.id);
    expect(detail.member.id).toBe(scenario.memberA);
    expect(detail.lineItems).toHaveLength(1);
  });
});
