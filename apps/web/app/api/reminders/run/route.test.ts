import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

const NOW = new Date();
const ISO = NOW.toISOString();
const IN_12_HOURS = new Date(NOW.getTime() + 12 * 60 * 60 * 1000).toISOString();
const IN_12_HOURS_END = new Date(NOW.getTime() + 13 * 60 * 60 * 1000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "Studio", slug: "s", timezone: "UTC", createdAt: ISO },
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
      notifyReminders: true,
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

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Alice",
  startsAt,
  endsAt: IN_12_HOURS_END,
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

let mockSessionToken: string;

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === SESSION_COOKIE) {
        return { value: mockSessionToken };
      }
      return undefined;
    },
  })),
}));

describe("POST /api/reminders/run", () => {
  beforeEach(async () => {
    mockSessionToken = await createSessionToken("test@example.com");

    const m1 = member("m1");
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1");

    const repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("POST /api/reminders/run returns 200 with a valid summary", async () => {
    const res = await POST();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionsProcessed: number; notificationsQueued: number };
    expect(body).toHaveProperty("sessionsProcessed");
    expect(body).toHaveProperty("notificationsQueued");
    expect(body.sessionsProcessed).toBe(1);
    expect(body.notificationsQueued).toBe(1);
  });
});
