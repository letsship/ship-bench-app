import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date();

describe("listBookingRows read bounds", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
  });

  it("never calls members.getById or classSessions.getById", async () => {
    const membersGetById = vi.spyOn(repos.members, "getById");
    const sessionsGetById = vi.spyOn(repos.classSessions, "getById");

    const rows = await listBookingRows(repos, studioId);

    expect(rows.length).toBeGreaterThan(0);
    expect(membersGetById).not.toHaveBeenCalled();
    expect(sessionsGetById).not.toHaveBeenCalled();
  });

  it("issues a fixed, small number of collection reads that does not grow with N", async () => {
    const seed = buildSeed(NOW);
    const studio = seed.studio;
    const existingSession = seed.sessions.find((s) => s.studioId === studio.id);
    if (!existingSession) throw new Error("seed must have at least one session");

    // Blow up the booking count far beyond the base seed, reusing existing
    // members and sessions so the join has plenty of rows to resolve.
    const extraMembers: Member[] = Array.from({ length: 50 }, (_, i) => ({
      id: `extra-member-${i}`,
      studioId: studio.id,
      name: `Extra Member ${i}`,
      email: `extra-${i}@example.com`,
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    }));
    const extraSessions: ClassSession[] = Array.from({ length: 20 }, (_, i) => ({
      ...existingSession,
      id: `extra-session-${i}`,
    }));
    const extraBookings: Booking[] = Array.from({ length: 300 }, (_, i) => ({
      id: `extra-booking-${i}`,
      sessionId: extraSessions[i % extraSessions.length].id,
      memberId: extraMembers[i % extraMembers.length].id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    }));

    const bigRepos = createInMemoryRepositories({
      ...seed,
      members: [...seed.members, ...extraMembers],
      sessions: [...seed.sessions, ...extraSessions],
      bookings: [...seed.bookings, ...extraBookings],
    });

    const membersListByStudio = vi.spyOn(bigRepos.members, "listByStudio");
    const sessionsListByStudio = vi.spyOn(bigRepos.classSessions, "listByStudio");
    const membersGetById = vi.spyOn(bigRepos.members, "getById");
    const sessionsGetById = vi.spyOn(bigRepos.classSessions, "getById");

    const rows = await listBookingRows(bigRepos, studio.id);

    expect(rows.length).toBeGreaterThanOrEqual(300);
    expect(membersGetById).not.toHaveBeenCalled();
    expect(sessionsGetById).not.toHaveBeenCalled();
    expect(membersListByStudio).toHaveBeenCalledTimes(1);
    expect(sessionsListByStudio).toHaveBeenCalledTimes(1);
  });

  it("preserves output shape and ascending startsAt order", async () => {
    const rows = await listBookingRows(repos, studioId);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("memberName");
      expect(row).toHaveProperty("className");
      expect(row).toHaveProperty("classColor");
      expect(row).toHaveProperty("instructor");
      expect(row).toHaveProperty("startsAt");
      expect(row).toHaveProperty("status");
    }
    const sorted = [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(rows).toEqual(sorted);
  });
});
