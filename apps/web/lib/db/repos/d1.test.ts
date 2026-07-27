import { describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";

// Minimal mock D1Database for basic factory testing.
// Note: Full integration testing with Drizzle over D1 requires a real D1 binding
// or a complete D1 implementation that supports Drizzle's internal `.raw()` method.
// This test verifies the factory function is exported and callable.
class MockD1Database {
  prepare(_sql: string) {
    return {
      bind: () => ({
        all: () => [],
        first: () => undefined,
        run: () => ({ changes: 0 }),
      }),
      all: () => [],
      first: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
}

describe("D1 repositories factory", () => {
  it("exports createD1Repositories factory function", () => {
    expect(typeof createD1Repositories).toBe("function");
  });

  it("factory returns a Repositories object with all required properties", () => {
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

  it("factory creates a Repositories with all repository methods", () => {
    const mockDb = new MockD1Database() as unknown as D1Database;
    const repos = createD1Repositories(mockDb);

    // Verify studios repo
    expect(typeof repos.studios.getFirst).toBe("function");

    // Verify settings repo
    expect(typeof repos.settings.getByStudioId).toBe("function");
    expect(typeof repos.settings.update).toBe("function");

    // Verify members repo
    expect(typeof repos.members.listByStudio).toBe("function");
    expect(typeof repos.members.getById).toBe("function");
    expect(typeof repos.members.findByEmail).toBe("function");
    expect(typeof repos.members.insert).toBe("function");
    expect(typeof repos.members.update).toBe("function");

    // Verify classTypes repo
    expect(typeof repos.classTypes.listByStudio).toBe("function");
    expect(typeof repos.classTypes.getById).toBe("function");
    expect(typeof repos.classTypes.insert).toBe("function");

    // Verify classSessions repo
    expect(typeof repos.classSessions.listByStudio).toBe("function");
    expect(typeof repos.classSessions.getById).toBe("function");
    expect(typeof repos.classSessions.insert).toBe("function");

    // Verify bookings repo
    expect(typeof repos.bookings.listBySessionIds).toBe("function");
    expect(typeof repos.bookings.listBySession).toBe("function");
    expect(typeof repos.bookings.getById).toBe("function");
    expect(typeof repos.bookings.insert).toBe("function");
    expect(typeof repos.bookings.update).toBe("function");

    // Verify invoices repo
    expect(typeof repos.invoices.listByStudio).toBe("function");
    expect(typeof repos.invoices.getById).toBe("function");
    expect(typeof repos.invoices.countByStudio).toBe("function");
    expect(typeof repos.invoices.insert).toBe("function");
    expect(typeof repos.invoices.update).toBe("function");

    // Verify invoiceLineItems repo
    expect(typeof repos.invoiceLineItems.listByInvoice).toBe("function");
    expect(typeof repos.invoiceLineItems.insertMany).toBe("function");

    // Verify outbox repo
    expect(typeof repos.outbox.insert).toBe("function");
    expect(typeof repos.outbox.listPending).toBe("function");
    expect(typeof repos.outbox.update).toBe("function");
  });
});
