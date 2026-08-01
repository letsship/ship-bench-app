import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-08-01T12:00:00.000Z");

interface ReadCounts {
  members: {
    getById: number;
    listByStudio: number;
  };
  classSessions: {
    getById: number;
    listByStudio: number;
  };
}

function instrumentReads(repos: Repositories): {
  repos: Repositories;
  counts: ReadCounts;
} {
  const counts: ReadCounts = {
    members: { getById: 0, listByStudio: 0 },
    classSessions: { getById: 0, listByStudio: 0 },
  };

  return {
    repos: {
      ...repos,
      members: {
        ...repos.members,
        async getById(id) {
          counts.members.getById += 1;
          return repos.members.getById(id);
        },
        async listByStudio(studioId) {
          counts.members.listByStudio += 1;
          return repos.members.listByStudio(studioId);
        },
      },
      classSessions: {
        ...repos.classSessions,
        async getById(id) {
          counts.classSessions.getById += 1;
          return repos.classSessions.getById(id);
        },
        async listByStudio(studioId, range) {
          counts.classSessions.listByStudio += 1;
          return repos.classSessions.listByStudio(studioId, range);
        },
      },
    },
    counts,
  };
}

function seedWithBookingCount(count: number): SeedData {
  const seed = buildSeed(NOW);
  const bookings = Array.from({ length: count }, (_, index) => ({
    ...seed.bookings[0],
    id: `booking-${index.toString().padStart(4, "0")}`,
    sessionId: seed.sessions[index % seed.sessions.length].id,
    memberId: seed.members[index % seed.members.length].id,
    status: index % 3 === 0 ? "waitlisted" : "confirmed",
  }));
  return { ...seed, bookings };
}

async function listWithReadCounts(seed: SeedData) {
  const expected = await listBookingRows(createInMemoryRepositories(seed), seed.studio.id);
  const instrumented = instrumentReads(createInMemoryRepositories(seed));
  const actual = await listBookingRows(instrumented.repos, seed.studio.id);
  expect(actual).toStrictEqual(expected);
  return { rows: actual, counts: instrumented.counts };
}

describe("listBookingRows", () => {
  it("keeps member and class-session reads fixed as booking count grows", async () => {
    const small = await listWithReadCounts(seedWithBookingCount(25));
    const large = await listWithReadCounts(seedWithBookingCount(500));

    expect(small.rows).toHaveLength(25);
    expect(large.rows).toHaveLength(500);
    expect(small.counts).toStrictEqual({
      members: { getById: 0, listByStudio: 1 },
      classSessions: { getById: 0, listByStudio: 1 },
    });
    expect(large.counts).toStrictEqual(small.counts);
  });

  it("preserves the booking row fields, fallbacks, and start-time order", async () => {
    const base = buildSeed(NOW);
    const seed: SeedData = {
      ...base,
      members: [{ ...base.members[0], id: "member-known", name: "Known Member" }],
      classTypes: [
        {
          ...base.classTypes[0],
          id: "type-known",
          name: "Known Class",
          color: "#123456",
        },
      ],
      sessions: [
        {
          ...base.sessions[0],
          id: "session-late",
          classTypeId: "type-known",
          instructor: "Late Teacher",
          startsAt: "2026-08-03T11:00:00.000Z",
        },
        {
          ...base.sessions[1],
          id: "session-early",
          classTypeId: "type-missing",
          instructor: "Early Teacher",
          startsAt: "2026-08-02T09:00:00.000Z",
        },
      ],
      bookings: [
        {
          ...base.bookings[0],
          id: "booking-late",
          sessionId: "session-late",
          memberId: "member-known",
          status: "confirmed",
        },
        {
          ...base.bookings[0],
          id: "booking-early",
          sessionId: "session-early",
          memberId: "member-missing",
          status: "waitlisted",
        },
      ],
    };
    const expected = await listBookingRows(createInMemoryRepositories(seed), seed.studio.id);
    const instrumented = instrumentReads(createInMemoryRepositories(seed));

    await expect(listBookingRows(instrumented.repos, seed.studio.id)).resolves.toStrictEqual(expected);
    expect(expected).toStrictEqual([
      {
        id: "booking-early",
        memberName: "—",
        className: "Class",
        classColor: "#6b7280",
        instructor: "Early Teacher",
        startsAt: "2026-08-02T09:00:00.000Z",
        status: "waitlisted",
      },
      {
        id: "booking-late",
        memberName: "Known Member",
        className: "Known Class",
        classColor: "#123456",
        instructor: "Late Teacher",
        startsAt: "2026-08-03T11:00:00.000Z",
        status: "confirmed",
      },
    ]);
  });
});
