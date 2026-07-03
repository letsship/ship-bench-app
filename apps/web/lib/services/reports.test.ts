import { describe, expect, it } from "vitest";
import { newId } from "@/lib/db/ids";
import { createTestDb } from "@/lib/db/local-db";
import { invoices } from "@/lib/db/schema";
import { setupScenario } from "@/lib/test-support";
import { getRevenueReport } from "./reports";
import { getStudioContext } from "./studio";

describe("reports service", () => {
  it("aggregates monthly revenue from invoices", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db);
    await db.insert(invoices).values([
      {
        id: newId("inv"),
        studioId: scenario.studioId,
        memberId: scenario.memberA,
        number: "INV-2026-0001",
        status: "paid",
        currency: "EUR",
        issuedAt: "2026-01-10T00:00:00Z",
        subtotalCents: 10000,
        taxCents: 0,
        totalCents: 10000,
      },
      {
        id: newId("inv"),
        studioId: scenario.studioId,
        memberId: scenario.memberA,
        number: "INV-2026-0002",
        status: "refunded",
        currency: "EUR",
        issuedAt: "2026-01-20T00:00:00Z",
        subtotalCents: 5000,
        taxCents: 0,
        totalCents: 5000,
      },
    ]);

    const ctx = await getStudioContext(db);
    const report = await getRevenueReport(db, ctx);
    expect(report.currency).toBe("EUR");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ month: "2026-01", paidCents: 10000, refundedCents: 5000 });
    expect(report.totals.netCents).toBe(5000);
  });
});
