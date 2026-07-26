import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingExportRows } from "./booking-export";

const ISO = "2026-01-01T00:00:00.000Z";

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
  email: `${id}@example.com`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string, over: Partial<ClassType> = {}): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
  ...over,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: "2026-06-15T09:00:00.000Z",
  endsAt: "2026-06-15T10:00:00.000Z",
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (
  id: string,
  sessionId: string,
  memberId: string,
  over: Partial<Booking> = {},
): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

describe("listBookingExportRows", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1", { name: "Rossi, Chiara" })],
        classTypes: [classType("ct1", { name: "Vinyasa Flow" })],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1", { status: "booked" })],
      }),
    );
  });

  it("joins to member name/email, class name, UTC start, and status", async () => {
    const rows = await listBookingExportRows(repos, "s1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      startsAt: "2026-06-15T09:00:00.000Z",
      className: "Vinyasa Flow",
      memberName: "Rossi, Chiara",
      memberEmail: "m1@example.com",
      status: "booked",
    });
  });

  it("is unbounded when both from and to are omitted", async () => {
    const rows = await listBookingExportRows(repos, "s1");
    expect(rows).toHaveLength(1);
  });

  it("is unbounded on the from side when only to is given", async () => {
    const rows = await listBookingExportRows(repos, "s1", { to: "2026-06-15T09:00:00.000Z" });
    expect(rows).toHaveLength(1);
  });

  it("is unbounded on the to side when only from is given", async () => {
    const rows = await listBookingExportRows(repos, "s1", { from: "2026-06-15T09:00:00.000Z" });
    expect(rows).toHaveLength(1);
  });

  it("includes a booking whose session starts exactly at the inclusive from bound", async () => {
    const rows = await listBookingExportRows(repos, "s1", {
      from: "2026-06-15T09:00:00.000Z",
      to: "2026-06-30T00:00:00.000Z",
    });
    expect(rows).toHaveLength(1);
  });

  it("includes a booking whose session starts exactly at the inclusive to bound", async () => {
    const rows = await listBookingExportRows(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T09:00:00.000Z",
    });
    expect(rows).toHaveLength(1);
  });

  it("excludes a booking just outside the to bound", async () => {
    const rows = await listBookingExportRows(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T08:59:59.999Z",
    });
    expect(rows).toHaveLength(0);
  });

  it("excludes a booking just outside the from bound", async () => {
    const rows = await listBookingExportRows(repos, "s1", {
      from: "2026-06-15T09:00:00.001Z",
      to: "2026-06-30T00:00:00.000Z",
    });
    expect(rows).toHaveLength(0);
  });

  it("sorts rows ascending by session start", async () => {
    const multi = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        classTypes: [classType("ct1")],
        sessions: [
          session("cs1", {
            startsAt: "2026-06-20T09:00:00.000Z",
            endsAt: "2026-06-20T10:00:00.000Z",
          }),
          session("cs2", {
            startsAt: "2026-06-10T09:00:00.000Z",
            endsAt: "2026-06-10T10:00:00.000Z",
          }),
        ],
        bookings: [booking("b1", "cs1", "m1"), booking("b2", "cs2", "m2")],
      }),
    );
    const rows = await listBookingExportRows(multi, "s1");
    expect(rows.map((row) => row.startsAt)).toEqual([
      "2026-06-10T09:00:00.000Z",
      "2026-06-20T09:00:00.000Z",
    ]);
  });
});

describe("listBookingExportRows against the demo seed", () => {
  it("returns rows joined from the shared seed", async () => {
    const repos = createInMemoryRepositories(buildSeed(new Date("2026-06-15T12:00:00.000Z")));
    const studioId = (await repos.studios.getFirst())!.id;
    const rows = await listBookingExportRows(repos, studioId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("memberEmail");
  });
});
