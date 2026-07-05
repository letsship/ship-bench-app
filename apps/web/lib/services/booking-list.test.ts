import { describe, expect, it } from "vitest";
import { newId } from "@/lib/db/ids";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { listBookingRowsForExport } from "./booking-list";

function buildRepos(): { repos: Repositories; studioId: string } {
  const studioId = newId();
  const classTypeId = newId();
  const memberId = newId();

  const earlySessionId = newId();
  const fromSessionId = newId();
  const midSessionId = newId();
  const toSessionId = newId();
  const lateSessionId = newId();

  const repos = createInMemoryRepositories({
    studio: {
      id: studioId,
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    settings: {
      studioId,
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [
      {
        id: memberId,
        studioId,
        name: "Chiara Rossi",
        email: "chiara@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    classTypes: [
      {
        id: classTypeId,
        studioId,
        name: "Vinyasa Flow",
        description: null,
        color: "#5b8c5a",
        defaultCapacity: 16,
        defaultPriceCents: 1800,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    sessions: [
      {
        id: earlySessionId,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: "2026-05-31T09:00:00.000Z",
        endsAt: "2026-05-31T10:00:00.000Z",
        capacity: 16,
        priceCents: 1800,
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: fromSessionId,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-06-01T01:00:00.000Z",
        capacity: 16,
        priceCents: 1800,
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: midSessionId,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: "2026-06-15T09:00:00.000Z",
        endsAt: "2026-06-15T10:00:00.000Z",
        capacity: 16,
        priceCents: 1800,
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: toSessionId,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: "2026-06-30T23:59:59.000Z",
        endsAt: "2026-07-01T00:59:59.000Z",
        capacity: 16,
        priceCents: 1800,
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: lateSessionId,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: "2026-07-01T09:00:00.000Z",
        endsAt: "2026-07-01T10:00:00.000Z",
        capacity: 16,
        priceCents: 1800,
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    bookings: [earlySessionId, fromSessionId, midSessionId, toSessionId, lateSessionId].map(
      (sessionId) => ({
        id: newId(),
        sessionId,
        memberId,
        status: "booked",
        bookedAt: "2026-01-02T00:00:00.000Z",
        cancelledAt: null,
      }),
    ),
    invoices: [],
    lineItems: [],
    outbox: [],
  });

  return { repos, studioId };
}

const FROM = "2026-06-01T00:00:00.000Z";
const TO = "2026-06-30T23:59:59.000Z";

describe("listBookingRowsForExport", () => {
  it("includes the member's email on each row", async () => {
    const { repos, studioId } = buildRepos();
    const rows = await listBookingRowsForExport(repos, studioId, { from: FROM, to: TO });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.email === "chiara@example.com")).toBe(true);
  });

  it("includes a session starting exactly at `from`", async () => {
    const { repos, studioId } = buildRepos();
    const rows = await listBookingRowsForExport(repos, studioId, { from: FROM, to: TO });
    expect(rows.some((row) => row.startsAt === FROM)).toBe(true);
  });

  it("includes a session starting exactly at `to`", async () => {
    const { repos, studioId } = buildRepos();
    const rows = await listBookingRowsForExport(repos, studioId, { from: FROM, to: TO });
    expect(rows.some((row) => row.startsAt === TO)).toBe(true);
  });

  it("excludes sessions outside the range", async () => {
    const { repos, studioId } = buildRepos();
    const rows = await listBookingRowsForExport(repos, studioId, { from: FROM, to: TO });
    expect(rows.some((row) => row.startsAt === "2026-05-31T09:00:00.000Z")).toBe(false);
    expect(rows.some((row) => row.startsAt === "2026-07-01T09:00:00.000Z")).toBe(false);
  });

  it("is unbounded on a side when that bound is omitted", async () => {
    const { repos, studioId } = buildRepos();
    const onlyFrom = await listBookingRowsForExport(repos, studioId, { from: FROM });
    expect(onlyFrom.some((row) => row.startsAt === "2026-07-01T09:00:00.000Z")).toBe(true);
    expect(onlyFrom.some((row) => row.startsAt === "2026-05-31T09:00:00.000Z")).toBe(false);

    const onlyTo = await listBookingRowsForExport(repos, studioId, { to: TO });
    expect(onlyTo.some((row) => row.startsAt === "2026-05-31T09:00:00.000Z")).toBe(true);
    expect(onlyTo.some((row) => row.startsAt === "2026-07-01T09:00:00.000Z")).toBe(false);
  });
});
