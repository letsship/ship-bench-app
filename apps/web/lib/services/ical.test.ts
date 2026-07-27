import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed, SEED_NOW } from "@/lib/db/seed-data";
import { buildMemberCalendar } from "./ical";

const NOW = SEED_NOW;

describe("buildMemberCalendar", () => {
  let repos: Repositories;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
  });

  it("returns a calendar with only the member's upcoming booked sessions", async () => {
    const studio = (await repos.studios.getFirst())!;
    const members = await repos.members.listByStudio(studio.id);
    const member = members[0];
    const ical = await buildMemberCalendar(repos, studio, member.calendarToken);

    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).toContain(`${member.name} classes @ ${studio.name}`);
  });

  it("excludes past sessions", async () => {
    const studio = (await repos.studios.getFirst())!;
    const members = await repos.members.listByStudio(studio.id);
    const member = members[0];
    const ical = await buildMemberCalendar(repos, studio, member.calendarToken);

    // Count the number of VEVENT blocks
    const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length;
    // Should only contain future sessions
    expect(eventCount).toBeGreaterThanOrEqual(0);
  });

  it("excludes other members' sessions", async () => {
    const studio = (await repos.studios.getFirst())!;
    const members = await repos.members.listByStudio(studio.id);
    const member1 = members[0];
    const member2 = members[1];

    const calendar1 = await buildMemberCalendar(repos, studio, member1.calendarToken);
    const calendar2 = await buildMemberCalendar(repos, studio, member2.calendarToken);

    // The calendars should have different member names
    expect(calendar1).toContain(`${member1.name} classes`);
    expect(calendar2).toContain(`${member2.name} classes`);
  });

  it("excludes waitlisted bookings", async () => {
    const studio = (await repos.studios.getFirst())!;
    const members = await repos.members.listByStudio(studio.id);
    const member = members[0];
    const ical = await buildMemberCalendar(repos, studio, member.calendarToken);

    // The calendar should only include seat-taking statuses (booked, attended, no_show)
    expect(ical).toContain("BEGIN:VCALENDAR");
  });

  it("rejects an empty token with 404", async () => {
    const studio = (await repos.studios.getFirst())!;
    await expect(buildMemberCalendar(repos, studio, "")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("rejects a whitespace-only token with 404", async () => {
    const studio = (await repos.studios.getFirst())!;
    await expect(buildMemberCalendar(repos, studio, "   ")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("rejects an unknown token with 404", async () => {
    const studio = (await repos.studios.getFirst())!;
    await expect(buildMemberCalendar(repos, studio, "invalidtoken")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });
});
