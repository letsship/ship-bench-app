import { describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";

// Minimal D1Database mock for factory structure verification.
// Full integration testing with Drizzle over D1 requires miniflare or a real D1 binding.
class MockD1Database {
  prepare(_sql: string) {
    return {
      bind: () => ({
        all: () => [],
        first: () => undefined,
        run: () => ({ changes: 0 }),
        raw: () => ({ all: () => [], first: () => undefined, run: () => ({ changes: 0 }) }),
      }),
      all: () => [],
      first: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
}

describe("D1 repositories factory", () => {
  it("createD1Repositories is exported and callable", () => {
    expect(typeof createD1Repositories).toBe("function");
  });

  it("factory creates a Repositories object with all required repository properties", () => {
    const mockDb = new MockD1Database() as unknown as D1Database;
    const repos = createD1Repositories(mockDb);

    expect(repos).toHaveProperty("studios");
    expect(repos).toHaveProperty("settings");
    expect(repos).toHaveProperty("members");
    expect(repos).toHaveProperty("classTypes");
    expect(repos).toHaveProperty("classSessions");
    expect(repos).toHaveProperty("bookings");
    expect(repos).toHaveProperty("invoices");
    expect(repos).toHaveProperty("invoiceLineItems");
    expect(repos).toHaveProperty("outbox");
  });

  it("each repository has the required methods", () => {
    const mockDb = new MockD1Database() as unknown as D1Database;
    const repos = createD1Repositories(mockDb);

    // Studios repo
    expect(typeof repos.studios.getFirst).toBe("function");

    // Settings repo
    expect(typeof repos.settings.getByStudioId).toBe("function");
    expect(typeof repos.settings.update).toBe("function");

    // Members repo
    expect(typeof repos.members.listByStudio).toBe("function");
    expect(typeof repos.members.getById).toBe("function");
    expect(typeof repos.members.findByEmail).toBe("function");
    expect(typeof repos.members.insert).toBe("function");
    expect(typeof repos.members.update).toBe("function");

    // ClassTypes repo
    expect(typeof repos.classTypes.listByStudio).toBe("function");
    expect(typeof repos.classTypes.getById).toBe("function");
    expect(typeof repos.classTypes.insert).toBe("function");

    // ClassSessions repo
    expect(typeof repos.classSessions.listByStudio).toBe("function");
    expect(typeof repos.classSessions.getById).toBe("function");
    expect(typeof repos.classSessions.insert).toBe("function");

    // Bookings repo
    expect(typeof repos.bookings.listBySessionIds).toBe("function");
    expect(typeof repos.bookings.listBySession).toBe("function");
    expect(typeof repos.bookings.getById).toBe("function");
    expect(typeof repos.bookings.insert).toBe("function");
    expect(typeof repos.bookings.update).toBe("function");

    // Invoices repo
    expect(typeof repos.invoices.listByStudio).toBe("function");
    expect(typeof repos.invoices.getById).toBe("function");
    expect(typeof repos.invoices.countByStudio).toBe("function");
    expect(typeof repos.invoices.insert).toBe("function");
    expect(typeof repos.invoices.update).toBe("function");

    // InvoiceLineItems repo
    expect(typeof repos.invoiceLineItems.listByInvoice).toBe("function");
    expect(typeof repos.invoiceLineItems.insertMany).toBe("function");

    // Outbox repo
    expect(typeof repos.outbox.insert).toBe("function");
    expect(typeof repos.outbox.listPending).toBe("function");
    expect(typeof repos.outbox.update).toBe("function");
  });

  it("factory methods are async (return promises)", () => {
    const mockDb = new MockD1Database() as unknown as D1Database;
    const repos = createD1Repositories(mockDb);

    // Verify that methods return promises without awaiting (to avoid D1 integration)
    const result = repos.studios.getFirst();
    expect(result instanceof Promise).toBe(true);
    // Catch any rejection to prevent unhandled rejection warnings
    result.catch(() => {});
  });
});
