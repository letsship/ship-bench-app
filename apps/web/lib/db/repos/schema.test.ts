import { describe, it, expect } from "vitest";
import {
  bookingsTable,
  classSessionsTable,
  classTypesTable,
  invoiceLineItemsTable,
  invoicesTable,
  membersTable,
  notificationOutboxTable,
  studioSettingsTable,
  studiosTable,
} from "./schema";
import { toSnakeKey } from "./mapping";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  InvoiceLineItem,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "../types";

// Hermetic guard: assert that the Drizzle schema tables/columns match the entity
// fields declared in lib/db/types.ts, so the D1 columns stay in lockstep with
// the entities, the migration SQL, and the fakes. This is not a live-DB test,
// matching the repo convention where the production adapter has no DB integration test.

function columnNameSet(table: Record<string, unknown>): Set<string> {
  return new Set(Object.values(table).map((col: Record<string, unknown>) => col.name));
}

function expectedColumnNames<T extends Record<string, unknown>>(sample: T): Set<string> {
  return new Set(Object.keys(sample).map((key) => toSnakeKey(key)));
}

describe("Drizzle schema parity", () => {
  it("studios table has all entity columns", () => {
    const sample: Studio = {
      id: "",
      name: "",
      slug: "",
      timezone: "",
      createdAt: "",
    };
    expect(columnNameSet(studiosTable)).toEqual(expectedColumnNames(sample));
  });

  it("studioSettings table has all entity columns", () => {
    const sample: StudioSettings = {
      studioId: "",
      currency: "",
      taxRateBps: 0,
      cancellationWindowHours: 0,
      waitlistEnabled: false,
      notifyBookingConfirmations: false,
      notifyCancellations: false,
      notifyWaitlistPromotions: false,
      notifyInvoices: false,
    };
    expect(columnNameSet(studioSettingsTable)).toEqual(expectedColumnNames(sample));
  });

  it("members table has all entity columns", () => {
    const sample: Member = {
      id: "",
      studioId: "",
      name: "",
      email: "",
      phone: null,
      status: "",
      notificationsOptedOut: false,
      createdAt: "",
    };
    expect(columnNameSet(membersTable)).toEqual(expectedColumnNames(sample));
  });

  it("classTypes table has all entity columns", () => {
    const sample: ClassType = {
      id: "",
      studioId: "",
      name: "",
      description: null,
      color: "",
      defaultCapacity: 0,
      defaultPriceCents: 0,
      createdAt: "",
    };
    expect(columnNameSet(classTypesTable)).toEqual(expectedColumnNames(sample));
  });

  it("classSessions table has all entity columns", () => {
    const sample: ClassSession = {
      id: "",
      studioId: "",
      classTypeId: "",
      instructor: "",
      startsAt: "",
      endsAt: "",
      capacity: 0,
      priceCents: 0,
      status: "",
      createdAt: "",
    };
    expect(columnNameSet(classSessionsTable)).toEqual(expectedColumnNames(sample));
  });

  it("bookings table has all entity columns", () => {
    const sample: Booking = {
      id: "",
      sessionId: "",
      memberId: "",
      status: "",
      bookedAt: "",
      cancelledAt: null,
    };
    expect(columnNameSet(bookingsTable)).toEqual(expectedColumnNames(sample));
  });

  it("invoices table has all entity columns", () => {
    const sample: Invoice = {
      id: "",
      studioId: "",
      memberId: "",
      number: "",
      status: "",
      currency: "",
      taxRateBps: 0,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      issuedAt: "",
      dueAt: null,
      paidAt: null,
      createdAt: "",
    };
    expect(columnNameSet(invoicesTable)).toEqual(expectedColumnNames(sample));
  });

  it("invoiceLineItems table has all entity columns", () => {
    const sample: InvoiceLineItem = {
      id: "",
      invoiceId: "",
      description: "",
      quantity: 0,
      unitAmountCents: 0,
      amountCents: 0,
      refunded: false,
      bookingId: null,
    };
    expect(columnNameSet(invoiceLineItemsTable)).toEqual(expectedColumnNames(sample));
  });

  it("notificationOutbox table has all entity columns", () => {
    const sample: NotificationOutboxRow = {
      id: "",
      memberId: "",
      kind: "",
      payload: "",
      createdAt: "",
      sentAt: null,
      providerMessageId: null,
      error: null,
    };
    expect(columnNameSet(notificationOutboxTable)).toEqual(expectedColumnNames(sample));
  });
});
