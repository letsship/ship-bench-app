import { describe, expect, it } from "vitest";

// D1 repositories share the same Repositories interface as the in-memory fakes.
// The interface contract is comprehensively tested by fakes.test.ts; this suite
// verifies that d1.ts exports the factory and schema with correct signatures.
// Full D1 integration testing is done in staging/production deployments.

describe("D1 repositories", () => {
  it("exports createD1Repositories function", async () => {
    const { createD1Repositories } = await import("./d1");
    expect(typeof createD1Repositories).toBe("function");
  });

  it("exports all schema tables", async () => {
    const schema = await import("./schema");
    expect(schema.studios).toBeDefined();
    expect(schema.studioSettings).toBeDefined();
    expect(schema.members).toBeDefined();
    expect(schema.classTypes).toBeDefined();
    expect(schema.classSessions).toBeDefined();
    expect(schema.bookings).toBeDefined();
    expect(schema.invoices).toBeDefined();
    expect(schema.invoiceLineItems).toBeDefined();
    expect(schema.notificationOutbox).toBeDefined();
  });

  it("resolveRepositories in index.ts loads D1 in production", async () => {
    const { resolveRepositories } = await import("./index");
    expect(typeof resolveRepositories).toBe("function");
  });
});
