import { describe, it, expect } from "vitest";
import * as schema from "./schema";

// Unit test of the Drizzle schema: verify that tables are defined and
// importable. The actual schema contract (column names, types, constraints)
// is verified by the migration SQL and the end-to-end repository tests
// (which exercise the adapter against in-memory fakes).

describe("Drizzle schema", () => {
  it("exports all table definitions", () => {
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
});
