import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { toSnakeKey } from "./repos/mapping";
import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studios,
  studioSettings,
} from "./schema";

// Guards schema/type drift without a live database: every schema.ts table's
// column-name set must match toSnakeKey(field) for every field on the
// corresponding lib/db/types.ts entity — the same transform the (now removed)
// Supabase repo relied on, and that the D1 repo's Drizzle mapping replaces.

function schemaSnakeColumns(table: Parameters<typeof getTableColumns>[0]): Set<string> {
  return new Set(Object.values(getTableColumns(table)).map((column) => column.name));
}

function entitySnakeColumns(fields: string[]): Set<string> {
  return new Set(fields.map(toSnakeKey));
}

describe("schema/entity column parity", () => {
  it("studios", () => {
    expect(schemaSnakeColumns(studios)).toEqual(
      entitySnakeColumns(["id", "name", "slug", "timezone", "createdAt"]),
    );
  });

  it("studio_settings", () => {
    expect(schemaSnakeColumns(studioSettings)).toEqual(
      entitySnakeColumns([
        "studioId",
        "currency",
        "taxRateBps",
        "cancellationWindowHours",
        "waitlistEnabled",
        "notifyBookingConfirmations",
        "notifyCancellations",
        "notifyWaitlistPromotions",
        "notifyInvoices",
      ]),
    );
  });

  it("members", () => {
    expect(schemaSnakeColumns(members)).toEqual(
      entitySnakeColumns([
        "id",
        "studioId",
        "name",
        "email",
        "phone",
        "status",
        "notificationsOptedOut",
        "createdAt",
      ]),
    );
  });

  it("class_types", () => {
    expect(schemaSnakeColumns(classTypes)).toEqual(
      entitySnakeColumns([
        "id",
        "studioId",
        "name",
        "description",
        "color",
        "defaultCapacity",
        "defaultPriceCents",
        "createdAt",
      ]),
    );
  });

  it("class_sessions", () => {
    expect(schemaSnakeColumns(classSessions)).toEqual(
      entitySnakeColumns([
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
      ]),
    );
  });

  it("bookings", () => {
    expect(schemaSnakeColumns(bookings)).toEqual(
      entitySnakeColumns(["id", "sessionId", "memberId", "status", "bookedAt", "cancelledAt"]),
    );
  });

  it("invoices", () => {
    expect(schemaSnakeColumns(invoices)).toEqual(
      entitySnakeColumns([
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
      ]),
    );
  });

  it("invoice_line_items", () => {
    expect(schemaSnakeColumns(invoiceLineItems)).toEqual(
      entitySnakeColumns([
        "id",
        "invoiceId",
        "description",
        "quantity",
        "unitAmountCents",
        "amountCents",
        "refunded",
        "bookingId",
      ]),
    );
  });

  it("notification_outbox", () => {
    expect(schemaSnakeColumns(notificationOutbox)).toEqual(
      entitySnakeColumns([
        "id",
        "memberId",
        "kind",
        "payload",
        "createdAt",
        "sentAt",
        "providerMessageId",
        "error",
      ]),
    );
  });
});
