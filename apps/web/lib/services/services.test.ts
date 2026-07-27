import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { type BookingRow, listBookingRows } from "./booking-list";
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
});

// The pre-batching per-booking join, kept verbatim as an oracle: the batched
// implementation must return byte-identical rows for any seed.
async function perBookingJoin(repos: Repositories, studioId: string): Promise<BookingRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((s) => s.id));

  const rows: BookingRow[] = [];
  for (const b of bookings) {
    const s = await repos.classSessions.getById(b.sessionId);
    const type = s ? typeById.get(s.classTypeId) : undefined;
    const m = await repos.members.getById(b.memberId);
    rows.push({
      id: b.id,
      memberName: m?.name ?? "—",
      className: type?.name ?? "Class",
      classColor: type?.color ?? "#6b7280",
      instructor: s?.instructor ?? "",
      startsAt: s?.startsAt ?? "",
      status: b.status,
    });
  }
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// N bookings spread over a handful of sessions whose start times descend, so
// the final `startsAt` sort genuinely reorders the rows.
function bookingsSeed(count: number): SeedData {
  const sessionCount = Math.min(count, 5);
  const sessions = Array.from({ length: sessionCount }, (_, i) =>
    session(`cs${i + 1}`, {
      instructor: `I${i + 1}`,
      startsAt: new Date(NOW.getTime() + (sessionCount - i) * 86_400_000).toISOString(),
    }),
  );
  return baseSeed({
    members: Array.from({ length: count }, (_, i) => member(`m${i + 1}`)),
    classTypes: [classType("ct1")],
    sessions,
    bookings: Array.from({ length: count }, (_, i) =>
      booking(`b${i + 1}`, `m${i + 1}`, { sessionId: sessions[i % sessionCount].id }),
    ),
  });
}

function trackReads(repos: Repositories) {
  const spies = {
    membersGetById: vi.spyOn(repos.members, "getById"),
    membersFindByIds: vi.spyOn(repos.members, "findByIds"),
    membersListByStudio: vi.spyOn(repos.members, "listByStudio"),
    sessionsGetById: vi.spyOn(repos.classSessions, "getById"),
    sessionsFindByIds: vi.spyOn(repos.classSessions, "findByIds"),
    sessionsListByStudio: vi.spyOn(repos.classSessions, "listByStudio"),
  };
  const total = () => Object.values(spies).reduce((sum, spy) => sum + spy.mock.calls.length, 0);
  return { ...spies, total };
}

describe("booking list read counts", () => {
  async function listWithReadCounts(count: number) {
    const repos = createInMemoryRepositories(bookingsSeed(count));
    const reads = trackReads(repos);
    const rows = await listBookingRows(repos, "s1");
    return { rows, reads };
  }

  it("never reads members or sessions one row at a time", async () => {
    const { rows, reads } = await listWithReadCounts(50);
    expect(rows).toHaveLength(50);
    expect(reads.membersGetById).not.toHaveBeenCalled();
    expect(reads.sessionsGetById).not.toHaveBeenCalled();
  });

  it("keeps member + class-session reads fixed as the booking count grows", async () => {
    const one = await listWithReadCounts(1);
    const many = await listWithReadCounts(50);
    expect(many.reads.total()).toBe(one.reads.total());
    expect(many.reads.total()).toBeLessThanOrEqual(4);
    expect(many.reads.membersFindByIds).toHaveBeenCalledTimes(1);
    expect(many.reads.sessionsFindByIds).toHaveBeenCalledTimes(1);
  });

  it("returns the same rows, fields and order as the per-booking join", async () => {
    for (const seed of [bookingsSeed(1), bookingsSeed(23), buildSeed(NOW)]) {
      const repos = createInMemoryRepositories(seed);
      const studioId = (await repos.studios.getFirst())?.id ?? "";
      expect(await listBookingRows(repos, studioId)).toEqual(await perBookingJoin(repos, studioId));
    }
  });

  it("keeps the missing-member fallback and honours the range filter", async () => {
    const seed = bookingsSeed(4);
    seed.bookings[0].memberId = "m_ghost";
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingRows(repos, "s1");
    expect(rows.find((row) => row.id === "b1")?.memberName).toBe("—");

    const from = seed.sessions[1].startsAt;
    const windowed = await listBookingRows(repos, "s1", { from });
    expect(windowed.every((row) => row.startsAt >= from)).toBe(true);
    expect(windowed.length).toBeLessThan(rows.length);
  });
});
