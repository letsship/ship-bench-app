import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/domain/booking-rules";
import { buildSeed } from "../seed-data";
import type { Booking } from "../types";
import { createInMemoryRepositories } from "./fakes";
import { DuplicateBookingError } from "./errors";
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

  describe("bookings.insert duplicate guard", () => {
    let repos: Repositories;
    let sessionId: string;

    beforeEach(async () => {
      repos = createInMemoryRepositories(buildSeed(NOW));
      const sessions = await repos.classSessions.listByStudio(
        (await repos.studios.getFirst())?.id ?? "",
      );
      sessionId = sessions[0].id;
    });

    const newBooking = (
      id: string,
      memberId: string,
      status: Booking["status"],
      cancelledAt: string | null = null,
    ): Booking => ({
      id,
      sessionId,
      memberId,
      status,
      bookedAt: NOW.toISOString(),
      cancelledAt,
    });

    it("throws DuplicateBookingError when an active booking already exists", async () => {
      await repos.bookings.insert(newBooking("b1", "m1", "booked"));
      await expect(
        repos.bookings.insert(newBooking("b2", "m1", "waitlisted")),
      ).rejects.toBeInstanceOf(DuplicateBookingError);
    });

    it("guards every active status that canBook treats as blocking", async () => {
      for (const status of ACTIVE_BOOKING_STATUSES) {
        const reposCase = createInMemoryRepositories(buildSeed(NOW));
        const sessions = await reposCase.classSessions.listByStudio(
          (await reposCase.studios.getFirst())?.id ?? "",
        );
        const sid = sessions[0].id;
        await reposCase.bookings.insert({
          id: "x1",
          sessionId: sid,
          memberId: "m1",
          status,
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        });
        await expect(
          reposCase.bookings.insert({
            id: "x2",
            sessionId: sid,
            memberId: "m1",
            status: "waitlisted",
            bookedAt: NOW.toISOString(),
            cancelledAt: null,
          }),
        ).rejects.toBeInstanceOf(DuplicateBookingError);
      }
    });

    it("does not throw when the prior booking was cancelled", async () => {
      await repos.bookings.insert(newBooking("b1", "m1", "cancelled", NOW.toISOString()));
      const inserted = await repos.bookings.insert(newBooking("b2", "m1", "booked"));
      expect(inserted.status).toBe("booked");
    });

    it("leaves the store untouched after a rejected insert", async () => {
      await repos.bookings.insert(newBooking("b1", "m1", "waitlisted"));
      await expect(
        repos.bookings.insert(newBooking("b2", "m1", "waitlisted")),
      ).rejects.toBeInstanceOf(DuplicateBookingError);
      const forMember = (await repos.bookings.listBySession(sessionId)).filter(
        (b) => b.memberId === "m1",
      );
      expect(forMember).toHaveLength(1);
    });
  });
});
