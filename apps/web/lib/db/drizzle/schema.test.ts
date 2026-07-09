import { describe, expect, it } from "vitest";
import * as schema from "./schema";

// Hermetic guard (no D1 binding required): every Drizzle table's JS column keys
// must exactly match the corresponding entity type in `lib/db/types.ts`, so a
// query result can be handed straight to callers with no mapping step — a typo
// here (e.g. `studioid` vs `studioId`) would otherwise only surface against a
// live D1 database.

const expectedColumns: Record<string, string[]> = {
  studios: ["id", "name", "slug", "timezone", "createdAt"],
  studioSettings: [
    "studioId",
    "currency",
    "taxRateBps",
    "cancellationWindowHours",
    "waitlistEnabled",
    "notifyBookingConfirmations",
    "notifyCancellations",
    "notifyWaitlistPromotions",
    "notifyInvoices",
  ],
  members: [
    "id",
    "studioId",
    "name",
    "email",
    "phone",
    "status",
    "notificationsOptedOut",
    "createdAt",
  ],
  classTypes: [
    "id",
    "studioId",
    "name",
    "description",
    "color",
    "defaultCapacity",
    "defaultPriceCents",
    "createdAt",
  ],
  classSessions: [
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
  ],
  bookings: ["id", "sessionId", "memberId", "status", "bookedAt", "cancelledAt"],
  invoices: [
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
  ],
  invoiceLineItems: [
    "id",
    "invoiceId",
    "description",
    "quantity",
    "unitAmountCents",
    "amountCents",
    "refunded",
    "bookingId",
  ],
  notificationOutbox: [
    "id",
    "memberId",
    "kind",
    "payload",
    "createdAt",
    "sentAt",
    "providerMessageId",
    "error",
  ],
};

describe("drizzle schema", () => {
  it("exports a table for every entity", () => {
    for (const name of Object.keys(expectedColumns)) {
      expect(schema[name as keyof typeof schema]).toBeDefined();
    }
  });

  it.each(Object.entries(expectedColumns))("%s columns match the entity type", (name, columns) => {
    const table = schema[name as keyof typeof schema] as Record<string, unknown>;
    expect(Object.keys(table).sort()).toEqual([...columns].sort());
  });
});
