import { describe, expect, it } from "vitest";
import * as schema from "./schema";

// Schema validation for D1 repositories. The Drizzle schema (schema.ts) must
// match the migration SQL (apps/web/migrations/0001_init.sql) and the entity
// types (lib/db/types.ts). This test verifies that the schema is properly
// exported and structured. The in-memory fakes (fakes.test.ts) prove behavioral
// equivalence, and all services/domain tests prove end-to-end behavior.

describe("D1 schema", () => {
  it("exports all nine tables", () => {
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

  it("studios table has all required columns", () => {
    // Verify the studios table has the required columns
    expect(schema.studios.id).toBeDefined();
    expect(schema.studios.name).toBeDefined();
    expect(schema.studios.slug).toBeDefined();
    expect(schema.studios.timezone).toBeDefined();
    expect(schema.studios.createdAt).toBeDefined();
  });

  it("members table has all required columns including foreign key", () => {
    expect(schema.members.id).toBeDefined();
    expect(schema.members.studioId).toBeDefined();
    expect(schema.members.email).toBeDefined();
    expect(schema.members.name).toBeDefined();
    expect(schema.members.status).toBeDefined();
    expect(schema.members.notificationsOptedOut).toBeDefined();
    expect(schema.members.createdAt).toBeDefined();
  });

  it("classTypes table has all required columns", () => {
    expect(schema.classTypes.id).toBeDefined();
    expect(schema.classTypes.studioId).toBeDefined();
    expect(schema.classTypes.name).toBeDefined();
    expect(schema.classTypes.defaultCapacity).toBeDefined();
    expect(schema.classTypes.defaultPriceCents).toBeDefined();
    expect(schema.classTypes.createdAt).toBeDefined();
  });

  it("classSessions table has all required columns including date range", () => {
    expect(schema.classSessions.id).toBeDefined();
    expect(schema.classSessions.studioId).toBeDefined();
    expect(schema.classSessions.classTypeId).toBeDefined();
    expect(schema.classSessions.startsAt).toBeDefined();
    expect(schema.classSessions.endsAt).toBeDefined();
    expect(schema.classSessions.capacity).toBeDefined();
    expect(schema.classSessions.priceCents).toBeDefined();
    expect(schema.classSessions.status).toBeDefined();
    expect(schema.classSessions.createdAt).toBeDefined();
  });

  it("bookings table has all required columns including timestamps", () => {
    expect(schema.bookings.id).toBeDefined();
    expect(schema.bookings.sessionId).toBeDefined();
    expect(schema.bookings.memberId).toBeDefined();
    expect(schema.bookings.status).toBeDefined();
    expect(schema.bookings.bookedAt).toBeDefined();
    expect(schema.bookings.cancelledAt).toBeDefined();
  });

  it("invoices table has all required columns including financial fields", () => {
    expect(schema.invoices.id).toBeDefined();
    expect(schema.invoices.studioId).toBeDefined();
    expect(schema.invoices.memberId).toBeDefined();
    expect(schema.invoices.number).toBeDefined();
    expect(schema.invoices.status).toBeDefined();
    expect(schema.invoices.currency).toBeDefined();
    expect(schema.invoices.taxRateBps).toBeDefined();
    expect(schema.invoices.subtotalCents).toBeDefined();
    expect(schema.invoices.taxCents).toBeDefined();
    expect(schema.invoices.totalCents).toBeDefined();
    expect(schema.invoices.issuedAt).toBeDefined();
    expect(schema.invoices.dueAt).toBeDefined();
    expect(schema.invoices.paidAt).toBeDefined();
    expect(schema.invoices.createdAt).toBeDefined();
  });

  it("invoiceLineItems table has all required columns", () => {
    expect(schema.invoiceLineItems.id).toBeDefined();
    expect(schema.invoiceLineItems.invoiceId).toBeDefined();
    expect(schema.invoiceLineItems.description).toBeDefined();
    expect(schema.invoiceLineItems.quantity).toBeDefined();
    expect(schema.invoiceLineItems.unitAmountCents).toBeDefined();
    expect(schema.invoiceLineItems.amountCents).toBeDefined();
    expect(schema.invoiceLineItems.refunded).toBeDefined();
    expect(schema.invoiceLineItems.bookingId).toBeDefined();
  });

  it("notificationOutbox table has all required columns", () => {
    expect(schema.notificationOutbox.id).toBeDefined();
    expect(schema.notificationOutbox.memberId).toBeDefined();
    expect(schema.notificationOutbox.kind).toBeDefined();
    expect(schema.notificationOutbox.payload).toBeDefined();
    expect(schema.notificationOutbox.createdAt).toBeDefined();
    expect(schema.notificationOutbox.sentAt).toBeDefined();
    expect(schema.notificationOutbox.providerMessageId).toBeDefined();
    expect(schema.notificationOutbox.error).toBeDefined();
  });

  it("studioSettings table has all required columns including boolean flags", () => {
    expect(schema.studioSettings.studioId).toBeDefined();
    expect(schema.studioSettings.currency).toBeDefined();
    expect(schema.studioSettings.taxRateBps).toBeDefined();
    expect(schema.studioSettings.cancellationWindowHours).toBeDefined();
    expect(schema.studioSettings.waitlistEnabled).toBeDefined();
    expect(schema.studioSettings.notifyBookingConfirmations).toBeDefined();
    expect(schema.studioSettings.notifyCancellations).toBeDefined();
    expect(schema.studioSettings.notifyWaitlistPromotions).toBeDefined();
    expect(schema.studioSettings.notifyInvoices).toBeDefined();
  });
});
