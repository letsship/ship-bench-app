import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { listBookingRows } from "./booking-list";
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
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
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
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
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

  it("lists booking rows joined to member + class", async () => {
    const rows = await listBookingRows(repos, studioId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("memberName");
    expect(rows[0]).toHaveProperty("className");
  });

  it("lists bookings with bounded repository reads (no N+1 queries)", async () => {
    // Regression test: verify that the number of members and classSessions
    // repository reads does not grow with the number of bookings.
    const createTestRepos = (bookingCount: number) => {
      const members = [member("m1"), member("m2")];
      const classTypes = [classType("ct1")];
      const sessions = [session("cs1"), session("cs2")];
      const bookings = [];
      for (let i = 0; i < bookingCount; i++) {
        bookings.push(
          booking(`b${i}`, i % 2 === 0 ? "m1" : "m2", { sessionId: i % 2 === 0 ? "cs1" : "cs2" }),
        );
      }
      return createInMemoryRepositories(baseSeed({ members, classTypes, sessions, bookings }));
    };

    // Count repository calls to detect N+1 queries.
    let membersReadCount = 0;
    let sessionsReadCount = 0;

    const wrapRepos = (repos: Repositories) => {
      const originalMembers = repos.members;
      const originalSessions = repos.classSessions;
      return {
        ...repos,
        members: {
          ...originalMembers,
          listByStudio: async (sid: string) => {
            membersReadCount++;
            return originalMembers.listByStudio(sid);
          },
        },
        classSessions: {
          ...originalSessions,
          listByStudio: async (sid: string, range) => {
            sessionsReadCount++;
            return originalSessions.listByStudio(sid, range);
          },
        },
      };
    };

    // Run with 1 booking.
    membersReadCount = 0;
    sessionsReadCount = 0;
    const repos1 = wrapRepos(await createTestRepos(1));
    const rows1 = await listBookingRows(repos1, "s1");
    const reads1 = { members: membersReadCount, sessions: sessionsReadCount };

    // Run with 50 bookings.
    membersReadCount = 0;
    sessionsReadCount = 0;
    const repos50 = wrapRepos(await createTestRepos(50));
    const rows50 = await listBookingRows(repos50, "s1");
    const reads50 = { members: membersReadCount, sessions: sessionsReadCount };

    // Verify reads are bounded (same for 1 and 50 bookings).
    expect(reads1.members).toBe(reads50.members);
    expect(reads1.sessions).toBe(reads50.sessions);
    expect(reads1.members).toBe(1);
    expect(reads1.sessions).toBe(1);

    // Verify output shape and order (sorted by startsAt).
    expect(rows1[0]).toHaveProperty("id");
    expect(rows1[0]).toHaveProperty("memberName");
    expect(rows1[0]).toHaveProperty("className");
    expect(rows50.every((r, i) => i === 0 || r.startsAt >= rows50[i - 1].startsAt)).toBe(true);
  });
});
