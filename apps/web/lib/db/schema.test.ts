import { describe, expect, it } from "vitest";
import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studioSettings,
  studios,
} from "./schema";

// Structural check: each Drizzle table must expose exactly the camelCase
// columns its matching domain type (./types) expects, so d1.ts query results
// already shape-match the app's entities with no manual row-mapping layer.

function columnKeys(table: object): string[] {
  return Object.keys(table).sort();
}

describe("drizzle schema shape", () => {
  it("studios matches Studio", () => {
    expect(columnKeys(studios)).toEqual(["createdAt", "id", "name", "slug", "timezone"].sort());
  });

  it("studioSettings matches StudioSettings", () => {
    expect(columnKeys(studioSettings)).toEqual(
      [
        "studioId",
        "currency",
        "taxRateBps",
        "cancellationWindowHours",
        "waitlistEnabled",
        "notifyBookingConfirmations",
        "notifyCancellations",
        "notifyWaitlistPromotions",
        "notifyInvoices",
      ].sort(),
    );
  });

  it("members matches Member", () => {
    expect(columnKeys(members)).toEqual(
      [
        "id",
        "studioId",
        "name",
        "email",
        "phone",
        "status",
        "notificationsOptedOut",
        "createdAt",
      ].sort(),
    );
  });

  it("classTypes matches ClassType", () => {
    expect(columnKeys(classTypes)).toEqual(
      [
        "id",
        "studioId",
        "name",
        "description",
        "color",
        "defaultCapacity",
        "defaultPriceCents",
        "createdAt",
      ].sort(),
    );
  });

  it("classSessions matches ClassSession", () => {
    expect(columnKeys(classSessions)).toEqual(
      [
        "id",
        "studioId",
        "classTypeId",
        "instructor",
        "startsAt",
        "endsAt",
        "capacity",
        "priceCents",
        "status",
        "createdAt",
      ].sort(),
    );
  });

  it("bookings matches Booking", () => {
    expect(columnKeys(bookings)).toEqual(
      ["id", "sessionId", "memberId", "status", "bookedAt", "cancelledAt"].sort(),
    );
  });

  it("invoices matches Invoice", () => {
    expect(columnKeys(invoices)).toEqual(
      [
        "id",
        "studioId",
        "memberId",
        "number",
        "status",
        "currency",
        "taxRateBps",
        "subtotalCents",
        "taxCents",
        "totalCents",
        "issuedAt",
        "dueAt",
        "paidAt",
        "createdAt",
      ].sort(),
    );
  });

  it("invoiceLineItems matches InvoiceLineItem", () => {
    expect(columnKeys(invoiceLineItems)).toEqual(
      [
        "id",
        "invoiceId",
        "description",
        "quantity",
        "unitAmountCents",
        "amountCents",
        "refunded",
        "bookingId",
      ].sort(),
    );
  });

  it("notificationOutbox matches NotificationOutboxRow", () => {
    expect(columnKeys(notificationOutbox)).toEqual(
      [
        "id",
        "memberId",
        "kind",
        "payload",
        "createdAt",
        "sentAt",
        "providerMessageId",
        "error",
      ].sort(),
    );
  });
});
