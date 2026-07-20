import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { UniqueConstraintError } from "./errors";
import { createInMemoryRepositories } from "./fakes";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("in-memory repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(members.length).toBeGreaterThan(0);
  });

  it("finds a member by email within the studio", async () => {
    const found = await repos.members.findByEmail(studioId, "amara@example.com");
    expect(found?.name).toBe("Amara Okafor");
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
  });

  it("inserts then reads back by id", async () => {
    const member = {
      id: "mem_new",
      studioId,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("update returns an isolated clone (store not mutated by reference)", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    updated.status = "active"; // mutate the returned object
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("empty repositories return nulls / empty lists", async () => {
    const empty = createInMemoryRepositories();
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
  });
});

describe("in-memory bookings repository: unique active booking constraint", () => {
  let repos: Repositories;

  beforeEach(async () => {
    const ISO = NOW.toISOString();
    const seed = {
      studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
      settings: {
        studioId: "s1",
        currency: "EUR",
        taxRateBps: 0,
        cancellationWindowHours: 12,
        waitlistEnabled: true,
        notifyBookingConfirmations: true,
        notifyCancellations: true,
        notifyWaitlistPromotions: true,
        notifyInvoices: true,
      },
      members: [
        {
          id: "m1",
          studioId: "s1",
          name: "M1",
          email: "m1@e.co",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: ISO,
        },
      ],
      classTypes: [
        {
          id: "ct1",
          studioId: "s1",
          name: "Yoga",
          description: null,
          color: "#111",
          defaultCapacity: 10,
          defaultPriceCents: 1000,
          createdAt: ISO,
        },
      ],
      sessions: [
        {
          id: "cs1",
          studioId: "s1",
          classTypeId: "ct1",
          instructor: "I",
          startsAt: "2026-03-22T10:00:00.000Z",
          endsAt: "2026-03-22T11:00:00.000Z",
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: ISO,
        },
      ],
      bookings: [],
      invoices: [],
      lineItems: [],
      outbox: [],
    };
    repos = createInMemoryRepositories(seed);
  });

  it("throws UniqueConstraintError when inserting an active duplicate (booked)", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await expect(repos.bookings.insert(booking2)).rejects.toThrow(UniqueConstraintError);
  });

  it("throws UniqueConstraintError when inserting an active duplicate (waitlisted)", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "waitlisted" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs1",
      memberId: "m1",
      status: "waitlisted" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await expect(repos.bookings.insert(booking2)).rejects.toThrow(UniqueConstraintError);
  });

  it("throws UniqueConstraintError when inserting an active duplicate (attended)", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "attended" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await expect(repos.bookings.insert(booking2)).rejects.toThrow(UniqueConstraintError);
  });

  it("allows a non-active duplicate (cancelled)", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "cancelled" as const,
      bookedAt: ISO,
      cancelledAt: ISO,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    const result = await repos.bookings.insert(booking2);
    expect(result.id).toBe("b2");
  });

  it("allows a non-active duplicate (no_show)", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "no_show" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs1",
      memberId: "m1",
      status: "waitlisted" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    const result = await repos.bookings.insert(booking2);
    expect(result.id).toBe("b2");
  });

  it("allows duplicates for different members on the same session", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs1",
      memberId: "m2",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    const result = await repos.bookings.insert(booking2);
    expect(result.id).toBe("b2");
  });

  it("allows duplicates for the same member on different sessions", async () => {
    const ISO = NOW.toISOString();
    const booking1 = {
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(booking1);

    const booking2 = {
      id: "b2",
      sessionId: "cs2",
      memberId: "m1",
      status: "booked" as const,
      bookedAt: ISO,
      cancelledAt: null,
    };
    const result = await repos.bookings.insert(booking2);
    expect(result.id).toBe("b2");
  });
});
