import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

const NOW = new Date();
const ISO = NOW.toISOString();
const IN_12H = new Date(NOW.getTime() + 12 * 3600 * 1000).toISOString();

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
}));

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

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 3600 * 1000).toISOString(),
  capacity: 10,
  priceCents: 1000,
  status: "active",
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

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_12H);
    const b1 = booking("b1", "s1", "m1");

    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          members: [m1],
          classTypes: [ct1],
          sessions: [s1],
          bookings: [b1],
        }),
      ),
    );
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns HTTP 200 on success", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it("queues a reminder on first run", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number; skipped: number };
    expect(body.queued).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it("is idempotent: a second call queues no duplicate", async () => {
    const res1 = await POST();
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { queued: number; skipped: number };
    expect(body1.queued).toBe(1);

    const res2 = await POST();
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { queued: number; skipped: number };
    expect(body2.queued).toBe(0);
    expect(body2.skipped).toBe(1);
  });
});
