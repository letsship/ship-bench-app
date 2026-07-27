import { describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";

describe("D1 repositories adapter", () => {
  it("exports createD1Repositories factory", () => {
    expect(typeof createD1Repositories).toBe("function");
  });

  it("factory function returns a Repositories object", () => {
    // Mock D1Database
    const mockD1: D1Database = {
      prepare: () => ({
        bind: () => ({
          first: async () => undefined,
          all: async () => [],
          run: async () => ({ success: true }),
        }),
        first: async () => undefined,
        all: async () => [],
        run: async () => ({ success: true }),
      }),
      batch: async () => [],
      exec: async () => ({ success: true }),
    };

    const repos = createD1Repositories(mockD1);

    expect(repos).toBeDefined();
    expect(repos.studios).toBeDefined();
    expect(repos.settings).toBeDefined();
    expect(repos.members).toBeDefined();
    expect(repos.classTypes).toBeDefined();
    expect(repos.classSessions).toBeDefined();
    expect(repos.bookings).toBeDefined();
    expect(repos.invoices).toBeDefined();
    expect(repos.invoiceLineItems).toBeDefined();
    expect(repos.outbox).toBeDefined();
  });

  it("has all repository methods", () => {
    const mockD1: D1Database = {
      prepare: () => ({
        bind: () => ({
          first: async () => undefined,
          all: async () => [],
          run: async () => ({ success: true }),
        }),
        first: async () => undefined,
        all: async () => [],
        run: async () => ({ success: true }),
      }),
      batch: async () => [],
      exec: async () => ({ success: true }),
    };

    const repos = createD1Repositories(mockD1);

    // Verify all expected methods exist
    expect(typeof repos.studios.getFirst).toBe("function");
    expect(typeof repos.settings.getByStudioId).toBe("function");
    expect(typeof repos.settings.update).toBe("function");
    expect(typeof repos.members.listByStudio).toBe("function");
    expect(typeof repos.members.getById).toBe("function");
    expect(typeof repos.members.findByEmail).toBe("function");
    expect(typeof repos.members.insert).toBe("function");
    expect(typeof repos.members.update).toBe("function");
    expect(typeof repos.classTypes.listByStudio).toBe("function");
    expect(typeof repos.classTypes.getById).toBe("function");
    expect(typeof repos.classTypes.insert).toBe("function");
    expect(typeof repos.classSessions.listByStudio).toBe("function");
    expect(typeof repos.classSessions.getById).toBe("function");
    expect(typeof repos.classSessions.insert).toBe("function");
    expect(typeof repos.bookings.listBySessionIds).toBe("function");
    expect(typeof repos.bookings.listBySession).toBe("function");
    expect(typeof repos.bookings.getById).toBe("function");
    expect(typeof repos.bookings.insert).toBe("function");
    expect(typeof repos.bookings.update).toBe("function");
    expect(typeof repos.invoices.listByStudio).toBe("function");
    expect(typeof repos.invoices.getById).toBe("function");
    expect(typeof repos.invoices.countByStudio).toBe("function");
    expect(typeof repos.invoices.insert).toBe("function");
    expect(typeof repos.invoices.update).toBe("function");
    expect(typeof repos.invoiceLineItems.listByInvoice).toBe("function");
    expect(typeof repos.invoiceLineItems.insertMany).toBe("function");
    expect(typeof repos.outbox.insert).toBe("function");
    expect(typeof repos.outbox.listPending).toBe("function");
    expect(typeof repos.outbox.update).toBe("function");
  });
});
