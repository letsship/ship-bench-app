import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { ActiveBookingConflictError } from "./errors";
import { createInMemoryRepositories } from "./fakes";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function makeBooking(
  id: string,
  status: string,
  over: { sessionId?: string; memberId?: string } = {},
) {
  return {
    id,
    sessionId: over.sessionId ?? "cs1",
    memberId: over.memberId ?? "m1",
    status,
    bookedAt: NOW.toISOString(),
    cancelledAt: status === "cancelled" ? NOW.toISOString() : null,
  };
}

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

describe("bookings repo — active booking guard", () => {
  it("rejects a second waitlisted booking for the same member + session", async () => {
    const repos = createInMemoryRepositories();
    await repos.bookings.insert(makeBooking("b1", "waitlisted"));
    await expect(repos.bookings.insert(makeBooking("b2", "waitlisted"))).rejects.toBeInstanceOf(
      ActiveBookingConflictError,
    );
  });

  it("rejects a second booked booking for the same member + session", async () => {
    const repos = createInMemoryRepositories();
    await repos.bookings.insert(makeBooking("b1", "booked"));
    await expect(repos.bookings.insert(makeBooking("b2", "booked"))).rejects.toBeInstanceOf(
      ActiveBookingConflictError,
    );
  });

  it("rejects a waitlisted booking when the member already holds a confirmed seat", async () => {
    const repos = createInMemoryRepositories();
    await repos.bookings.insert(makeBooking("b1", "booked"));
    await expect(repos.bookings.insert(makeBooking("b2", "waitlisted"))).rejects.toBeInstanceOf(
      ActiveBookingConflictError,
    );
  });

  it("allows a new booking once the prior one is cancelled", async () => {
    const repos = createInMemoryRepositories();
    await repos.bookings.insert(makeBooking("b1", "cancelled"));
    const inserted = await repos.bookings.insert(makeBooking("b2", "waitlisted"));
    expect(inserted.status).toBe("waitlisted");
    expect(await repos.bookings.listBySession("cs1")).toHaveLength(2);
  });

  it("does not block a different member on the same session", async () => {
    const repos = createInMemoryRepositories();
    await repos.bookings.insert(makeBooking("b1", "booked"));
    const inserted = await repos.bookings.insert(
      makeBooking("b2", "waitlisted", { memberId: "m2" }),
    );
    expect(inserted.status).toBe("waitlisted");
  });
});
