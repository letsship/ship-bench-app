import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { startSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

interface TestCookieStore {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
  clear(): void;
}

declare global {
  var __testCookieStore: TestCookieStore;
}

function getTestCookieStore(): TestCookieStore {
  return globalThis.__testCookieStore;
}

globalThis.__testCookieStore = {
  store: new Map<string, string>(),
  get(name: string) {
    return (this.store as Map<string, string>).get(name);
  },
  set(name: string, value: string) {
    (this.store as Map<string, string>).set(name, value);
  },
  delete(name: string) {
    (this.store as Map<string, string>).delete(name);
  },
  clear() {
    (this.store as Map<string, string>).clear();
  },
};

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const value = getTestCookieStore().get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string, _opts?: unknown) => {
      getTestCookieStore().set(name, value);
    },
    delete: (name: string) => {
      getTestCookieStore().delete(name);
    },
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

function seedData(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW.toISOString() },
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
  createdAt: NOW.toISOString(),
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
  createdAt: NOW.toISOString(),
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: NOW.toISOString(),
  endsAt: new Date(NOW.getTime() + 3600000).toISOString(),
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW.toISOString(),
  ...over,
});

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: NOW.toISOString(),
  cancelledAt: null,
  ...over,
});

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("GET /api/export", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    getTestCookieStore().clear();
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 401 without a session cookie", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });

  it("returns CSV with correct columns when signed in", async () => {
    await startSession("bookkeeper@example.com");
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    const body = await res.text();
    const [header] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("filters bookings by from/to inclusive of both ends", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seedData({
          members: [member("m1"), member("m2"), member("m3")],
          classTypes: [classType("ct1")],
          sessions: [
            session("cs1", { startsAt: "2026-06-01T08:00:00.000Z", endsAt: "2026-06-01T09:00:00.000Z" }),
            session("cs2", { startsAt: "2026-06-02T08:00:00.000Z", endsAt: "2026-06-02T09:00:00.000Z" }),
            session("cs3", { startsAt: "2026-06-03T08:00:00.000Z", endsAt: "2026-06-03T09:00:00.000Z" }),
          ],
          bookings: [
            booking("b1", "m1", { sessionId: "cs1" }),
            booking("b2", "m2", { sessionId: "cs2" }),
            booking("b3", "m3", { sessionId: "cs3" }),
          ],
        }),
      ),
    );
    await startSession("bookkeeper@example.com");
    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-06-01T08:00:00.000Z&to=2026-06-02T08:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const rows = body.split("\r\n").slice(1).filter(Boolean);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("2026-06-01T08:00:00.000Z");
    expect(rows[1]).toContain("2026-06-02T08:00:00.000Z");
  });

  it("round-trips a comma in a member name as a single quoted CSV column", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seedData({
          members: [member("m1", { name: "Rossi, Chiara", email: "chiara@example.com" })],
          classTypes: [classType("ct1")],
          sessions: [
            session("cs1", { startsAt: "2026-06-01T08:00:00.000Z", endsAt: "2026-06-01T09:00:00.000Z" }),
          ],
          bookings: [booking("b1", "m1", { sessionId: "cs1" })],
        }),
      ),
    );
    await startSession("bookkeeper@example.com");
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    const body = await res.text();
    const [, row] = body.split("\r\n");
    expect(row).toContain('"Rossi, Chiara"');
  });
});
