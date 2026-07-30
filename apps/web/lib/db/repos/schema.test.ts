import { describe, expect, it } from "vitest";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { toSnakeKey } from "./mapping";
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

// The Drizzle schema is what replaces the old snake_case↔camelCase row mapping
// on the production path: each table property keeps the entity's camelCase field
// name and carries the snake_case column name. These tests pin that contract —
// the field list per table, the column name for each field, and the storage type
// (text for ids/timestamps, integer for amounts, integer-boolean for flags) — so
// a drifting column can never silently reach D1.

interface TableContract {
  table: SQLiteTable;
  tableName: string;
  fields: string[];
  booleans?: string[];
  numbers?: string[];
}

const CONTRACTS: TableContract[] = [
  {
    table: studios,
    tableName: "studios",
    fields: ["id", "name", "slug", "timezone", "createdAt"],
  },
  {
    table: studioSettings,
    tableName: "studio_settings",
    fields: [
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
    booleans: [
      "waitlistEnabled",
      "notifyBookingConfirmations",
      "notifyCancellations",
      "notifyWaitlistPromotions",
      "notifyInvoices",
    ],
    numbers: ["taxRateBps", "cancellationWindowHours"],
  },
  {
    table: members,
    tableName: "members",
    fields: [
      "id",
      "studioId",
      "name",
      "email",
      "phone",
      "status",
      "notificationsOptedOut",
      "createdAt",
    ],
    booleans: ["notificationsOptedOut"],
  },
  {
    table: classTypes,
    tableName: "class_types",
    fields: [
      "id",
      "studioId",
      "name",
      "description",
      "color",
      "defaultCapacity",
      "defaultPriceCents",
      "createdAt",
    ],
    numbers: ["defaultCapacity", "defaultPriceCents"],
  },
  {
    table: classSessions,
    tableName: "class_sessions",
    fields: [
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
    numbers: ["capacity", "priceCents"],
  },
  {
    table: bookings,
    tableName: "bookings",
    fields: ["id", "sessionId", "memberId", "status", "bookedAt", "cancelledAt"],
  },
  {
    table: invoices,
    tableName: "invoices",
    fields: [
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
    numbers: ["taxRateBps", "subtotalCents", "taxCents", "totalCents"],
  },
  {
    table: invoiceLineItems,
    tableName: "invoice_line_items",
    fields: [
      "id",
      "invoiceId",
      "description",
      "quantity",
      "unitAmountCents",
      "amountCents",
      "refunded",
      "bookingId",
    ],
    booleans: ["refunded"],
    numbers: ["quantity", "unitAmountCents", "amountCents"],
  },
  {
    table: notificationOutbox,
    tableName: "notification_outbox",
    fields: [
      "id",
      "memberId",
      "kind",
      "payload",
      "createdAt",
      "sentAt",
      "providerMessageId",
      "error",
    ],
  },
];

function columnOf(table: SQLiteTable, field: string): SQLiteColumn {
  return (table as unknown as Record<string, SQLiteColumn>)[field];
}

describe.each(CONTRACTS)("$tableName", ({ table, tableName, fields, booleans, numbers }) => {
  it("uses the expected SQLite table name", () => {
    expect(getTableConfig(table).name).toBe(tableName);
  });

  it("exposes exactly the entity's fields as columns", () => {
    const config = getTableConfig(table);
    expect(config.columns.map((column) => column.name).sort()).toEqual(
      fields.map(toSnakeKey).sort(),
    );
  });

  it.each(fields)("maps %s to its snake_case column", (field) => {
    expect(columnOf(table, field).name).toBe(toSnakeKey(field));
  });

  it("stores boolean fields as integer-boolean columns", () => {
    for (const field of booleans ?? []) {
      expect(columnOf(table, field).dataType).toBe("boolean");
      expect(columnOf(table, field).columnType).toBe("SQLiteBoolean");
    }
  });

  it("stores numeric fields as integer columns", () => {
    for (const field of numbers ?? []) {
      expect(columnOf(table, field).columnType).toBe("SQLiteInteger");
    }
  });

  it("stores every remaining field as text", () => {
    const nonText = new Set([...(booleans ?? []), ...(numbers ?? [])]);
    for (const field of fields.filter((name) => !nonText.has(name))) {
      expect(columnOf(table, field).columnType).toBe("SQLiteText");
    }
  });
});

describe("schema keys", () => {
  it("declares a single-column primary key per table", () => {
    const primaries = CONTRACTS.map(({ tableName, table }) => [
      tableName,
      getTableConfig(table)
        .columns.filter((column) => column.primary)
        .map((column) => column.name),
    ]);
    expect(primaries).toEqual([
      ["studios", ["id"]],
      ["studio_settings", ["studio_id"]],
      ["members", ["id"]],
      ["class_types", ["id"]],
      ["class_sessions", ["id"]],
      ["bookings", ["id"]],
      ["invoices", ["id"]],
      ["invoice_line_items", ["id"]],
      ["notification_outbox", ["id"]],
    ]);
  });

  it("keeps the nullable entity fields nullable", () => {
    expect(columnOf(members, "phone").notNull).toBe(false);
    expect(columnOf(classTypes, "description").notNull).toBe(false);
    expect(columnOf(bookings, "cancelledAt").notNull).toBe(false);
    expect(columnOf(invoices, "dueAt").notNull).toBe(false);
    expect(columnOf(invoices, "paidAt").notNull).toBe(false);
    expect(columnOf(invoiceLineItems, "bookingId").notNull).toBe(false);
    expect(columnOf(notificationOutbox, "sentAt").notNull).toBe(false);
    expect(columnOf(notificationOutbox, "providerMessageId").notNull).toBe(false);
    expect(columnOf(notificationOutbox, "error").notNull).toBe(false);
  });
});
