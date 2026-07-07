import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { listBookingRows, listBookingsForExport } from "./booking-list";
import { cancelBooking, createBooking } from "./bookings";
import { createSession, getSessionView, listSessions } from "./classes";
import { getDashboard } from "./dashboard";
import { createInvoice, getInvoiceDetail, listInvoices, updateInvoiceStatus } from "./invoices";
import { createMember, getMember, updateMember } from "./members";
import { getRevenueReport } from "./reports";
import { getStudioContext } from "./studio";

// Anchored to the real clock: the booking/cancellation rules compare against
// `new Date()` inside the services, so fixtures must be genuinely future/past.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
const SOON = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();
const SOON_END = new Date(NOW.getTime() + 3 * 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

describe("members service", () => {
  let repos: Repositories;
  let studioId: string;
  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
  });

  it("rejects a duplicate email with 409", async () => {
    await expect(
      createMember(repos, studioId, { name: "Dup", email: "amara@example.com", status: "active" }),
    ).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("creates and updates a member", async () => {
    const created = await createMember(repos, studioId, {
      name: "New",
      email: "new@example.com",
      status: "active",
    });
    const updated = await updateMember(repos, created.id, { status: "paused" });
    expect(updated.status).toBe("paused");
  });

  it("getMember 404s for an unknown id", async () => {
    await expect(getMember(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("classes service", () => {
  it("computes occupancy on listed sessions", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 3 })],
        bookings: [booking("b1", "m1"), booking("b2", "m2", { status: "waitlisted" })],
      }),
    );
    const [view] = await listSessions(repos, "s1");
    expect(view.occupancy.booked).toBe(1);
    expect(view.occupancy.waitlisted).toBe(1);
    expect(view.classTypeName).toBe("Yoga");
  });

  it("rejects a session with an unknown class type", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(
      createSession(repos, "s1", {
        classTypeId: "nope",
        instructor: "I",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 5,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("getSessionView 404s for an unknown id", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(getSessionView(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("bookings service", () => {
  it("books an open future session and sends a confirmation", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({ classTypes: [classType("ct1")], sessions: [session("cs1")], members: [member("m1")] }),
    );
    const provider = createFakeProvider();
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect(result.status).toBe("booked");
    expect(provider.sent.map((m) => m.kind)).toEqual(["booking_confirmation"]);
  });

  it("waitlists when full (and sends no confirmation)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m2" });
    expect(result.status).toBe("waitlisted");
    expect(provider.sent).toHaveLength(0);
  });

  it("rejects a double booking with 409", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
  });

  it("marks a far-off cancellation refund-eligible", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({ classTypes: [classType("ct1")], sessions: [session("cs1")], members: [member("m1")], bookings: [booking("b1", "m1")] }),
    );
    const result = await cancelBooking(repos, createFakeProvider(), "b1");
    expect(result.refundEligible).toBe(true);
  });

  it("marks a last-minute cancellation refund-ineligible", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { startsAt: SOON, endsAt: SOON_END })],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const result = await cancelBooking(repos, createFakeProvider(), "b1");
    expect(result.refundEligible).toBe(false);
  });

  it("promotes the earliest waitlisted member when a seat frees up", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2"), member("m3")],
        bookings: [
          booking("b1", "m1"),
          booking("b2", "m2", { status: "waitlisted", bookedAt: "2026-03-15T10:00:00.000Z" }),
          booking("b3", "m3", { status: "waitlisted", bookedAt: "2026-03-15T11:00:00.000Z" }),
        ],
      }),
    );
    const provider = createFakeProvider();
    const result = await cancelBooking(repos, provider, "b1");
    expect(result.promotedMemberId).toBe("m2");
    expect((await repos.bookings.getById("b2"))?.status).toBe("booked");
    expect(provider.sent.map((m) => m.kind).sort()).toEqual([
      "booking_cancellation",
      "waitlist_promotion",
    ]);
  });
});

describe("invoices service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;
  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  it("computes subtotal + tax + total and sends invoice_issued", async () => {
    const provider = createFakeProvider();
    const detail = await createInvoice(repos, provider, studioId, {
      memberId,
      lineItems: [{ description: "Pass", quantity: 2, unitAmountCents: 1000 }],
    });
    expect(detail.invoice.subtotalCents).toBe(2000);
    expect(detail.invoice.taxCents).toBe(180);
    expect(detail.invoice.totalCents).toBe(2180);
    // buildSeed already has one pending outbox row, so assert our specific
    // invoice notification went out rather than an exact array.
    expect(provider.sent.some((m) => m.subject === `Invoice ${detail.invoice.number}`)).toBe(true);
  });

  it("allows a valid status transition and rejects an invalid one", async () => {
    const provider = createFakeProvider();
    const detail = await createInvoice(repos, provider, studioId, {
      memberId,
      lineItems: [{ description: "Pass", quantity: 1, unitAmountCents: 1000 }],
    });
    const paid = await updateInvoiceStatus(repos, detail.invoice.id, "paid");
    expect(paid.status).toBe("paid");
    await expect(updateInvoiceStatus(repos, detail.invoice.id, "open")).rejects.toMatchObject({
      status: 409,
      code: "invalid_transition",
    });
  });

  it("lists invoices with member names and reads a detail", async () => {
    const list = await listInvoices(repos, studioId);
    expect(list.length).toBeGreaterThan(0);
    const detail = await getInvoiceDetail(repos, list[0].id);
    expect(detail.member.id).toBe(detail.invoice.memberId);
  });
});

describe("reports + dashboard + booking list", () => {
  let repos: Repositories;
  let studioId: string;
  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
  });

  it("summarises monthly revenue", async () => {
    const report = await getRevenueReport(repos, await getStudioContext(repos));
    expect(report.rows.length).toBeGreaterThan(0);
    expect(report.totals.paidCents).toBeGreaterThan(0);
    expect(report.currency).toBe("EUR");
  });

  it("builds the dashboard", async () => {
    const data = await getDashboard(repos, await getStudioContext(repos));
    expect(data.stats.activeMembers).toBeGreaterThan(0);
    expect(Array.isArray(data.today)).toBe(true);
  });

  it("listBookingsForExport includes both bounds", async () => {
    const fromTime = "2026-03-15T10:00:00.000Z";
    const toTime = "2026-03-15T14:00:00.000Z";
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [
          member("m1", { name: "A", email: "a@e.co" }),
          member("m2", { name: "B", email: "b@e.co" }),
          member("m3", { name: "C", email: "c@e.co" }),
        ],
        sessions: [
          session("before", { startsAt: "2026-03-15T09:00:00.000Z", endsAt: "2026-03-15T10:00:00.000Z" }),
          session("atFrom", { startsAt: fromTime, endsAt: "2026-03-15T11:00:00.000Z" }),
          session("middle", { startsAt: "2026-03-15T12:00:00.000Z", endsAt: "2026-03-15T13:00:00.000Z" }),
          session("atTo", { startsAt: toTime, endsAt: "2026-03-15T15:00:00.000Z" }),
          session("after", { startsAt: "2026-03-15T16:00:00.000Z", endsAt: "2026-03-15T17:00:00.000Z" }),
        ],
        bookings: [
          booking("b1", "m1", { sessionId: "before" }),
          booking("b2", "m1", { sessionId: "atFrom" }),
          booking("b3", "m2", { sessionId: "middle" }),
          booking("b4", "m3", { sessionId: "atTo" }),
          booking("b5", "m3", { sessionId: "after" }),
        ],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", { from: fromTime, to: toTime });
    expect(rows.map((r) => r.id)).toEqual(["b2", "b3", "b4"]);
  });

  it("listBookingsForExport with unbounded from returns everything up to to", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1", { name: "A", email: "a@e.co" })],
        sessions: [
          session("before", { startsAt: "2026-03-15T09:00:00.000Z", endsAt: "2026-03-15T10:00:00.000Z" }),
          session("atTo", { startsAt: "2026-03-15T14:00:00.000Z", endsAt: "2026-03-15T15:00:00.000Z" }),
        ],
        bookings: [
          booking("b1", "m1", { sessionId: "before" }),
          booking("b2", "m1", { sessionId: "atTo" }),
        ],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", { to: "2026-03-15T14:00:00.000Z" });
    expect(rows.map((r) => r.id)).toEqual(["b1", "b2"]);
  });

  it("listBookingsForExport with unbounded to returns everything from from", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1", { name: "A", email: "a@e.co" })],
        sessions: [
          session("atFrom", { startsAt: "2026-03-15T14:00:00.000Z", endsAt: "2026-03-15T15:00:00.000Z" }),
          session("after", { startsAt: "2026-03-15T16:00:00.000Z", endsAt: "2026-03-15T17:00:00.000Z" }),
        ],
        bookings: [
          booking("b1", "m1", { sessionId: "atFrom" }),
          booking("b2", "m1", { sessionId: "after" }),
        ],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", { from: "2026-03-15T14:00:00.000Z" });
    expect(rows.map((r) => r.id)).toEqual(["b1", "b2"]);
  });
});
