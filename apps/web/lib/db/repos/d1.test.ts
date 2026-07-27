import { describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";

// Smoke test: verifies that the D1 adapter can be constructed. Full behavior
// parity is verified by the fakes tests, which exercise the same repository
// interface. This test exists to catch import/type errors in the D1 adapter.
describe("D1 repositories", () => {
  it("can be constructed with a D1Database binding", () => {
    // Create a mock D1Database for type checking purposes.
    // The actual D1 binding is only available at runtime in a Cloudflare Worker.
    const mockDB = {} as D1Database;
    const repos = createD1Repositories(mockDB);

    // Verify the adapter implements the Repositories interface.
    expect(repos.studios).toBeDefined();
    expect(repos.settings).toBeDefined();
    expect(repos.members).toBeDefined();
    expect(repos.classTypes).toBeDefined();
    expect(repos.classSessions).toBeDefined();
    expect(repos.bookings).toBeDefined();
    expect(repos.invoices).toBeDefined();
    expect(repos.invoiceLineItems).toBeDefined();
    expect(repos.outbox).toBeDefined();

    // Verify each repository has the expected methods.
    expect(typeof repos.studios.getFirst).toBe("function");
    expect(typeof repos.settings.getByStudioId).toBe("function");
    expect(typeof repos.members.listByStudio).toBe("function");
    expect(typeof repos.classTypes.listByStudio).toBe("function");
    expect(typeof repos.classSessions.listByStudio).toBe("function");
    expect(typeof repos.bookings.listBySessionIds).toBe("function");
    expect(typeof repos.invoices.listByStudio).toBe("function");
    expect(typeof repos.invoiceLineItems.listByInvoice).toBe("function");
    expect(typeof repos.outbox.listPending).toBe("function");
  });
});
