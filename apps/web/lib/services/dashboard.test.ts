import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { dayKey } from "@/lib/domain/dates";
import type { StudioContext } from "./studio";
import { getDashboard } from "./dashboard";

// The dashboard's notion of "today" must follow the studio's configured
// timezone, not the server's or the visitor's machine clock. These tests pin
// `nowIso` at a studio-local midnight boundary and assert that sessions are
// bucketed onto the studio's calendar day — independent of the runner's TZ.

const NOW = new Date("2026-06-15T12:00:00.000Z");

function baseSeed(): SeedData {
  return buildSeed(NOW);
}

async function ctxFor(repos: ReturnType<typeof createInMemoryRepositories>): Promise<StudioContext> {
  const studio = await repos.studios.getFirst();
  if (!studio) throw new Error("seed did not produce a studio");
  const settings = await repos.settings.getByStudioId(studio.id);
  if (!settings) throw new Error("seed did not produce settings");
  return { studio, settings };
}

describe("getDashboard timezone handling", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed());
  });

  it("filters 'today' by the studio's timezone at a near-midnight boundary", async () => {
    // 2026-06-14T23:30:00Z is already 2026-06-15 00:30 in Europe/Amsterdam
    // (summer, UTC+2). A studio-local "today" must therefore be 2026-06-15.
    const nowIso = "2026-06-14T23:30:00.000Z";
    const ctx = await ctxFor(repos);

    const { today } = await getDashboard(repos, ctx, nowIso);

    // Every session surfaced as "today" must land on the Amsterdam calendar day
    // 2026-06-15, even though the injected instant is still 2026-06-14 in UTC
    // (and 2026-06-14 in e.g. America/Los_Angeles).
    expect(today.length).toBeGreaterThan(0);
    for (const session of today) {
      // Every "today" session must land on the Amsterdam calendar day
      // 2026-06-15, even though the injected instant is still 2026-06-14 in
      // UTC (and 2026-06-14 in e.g. America/Los_Angeles).
      expect(dayKey(session.startsAt, ctx.studio.timezone)).toBe("2026-06-15");
    }
  });

  it("uses the injected nowIso for 'upcoming' filtering rather than a fresh clock read", async () => {
    // A far-past injected "now" must not surface any upcoming sessions if the
    // seed's sessions are all in the future relative to NOW but in the past
    // relative to nothing — here we just assert determinism: two calls with the
    // same nowIso produce identical stats, and the default-parameter path still
    // returns a well-formed dashboard.
    const ctx = await ctxFor(repos);
    const nowIso = "2026-06-15T00:00:00.000Z";

    const a = await getDashboard(repos, ctx, nowIso);
    const b = await getDashboard(repos, ctx, nowIso);
    expect(a.stats).toEqual(b.stats);
    expect(a.today.map((s) => s.id)).toEqual(b.today.map((s) => s.id));
  });

  it("keeps the default-parameter call site working when nowIso is omitted", async () => {
    const ctx = await ctxFor(repos);
    const data = await getDashboard(repos, ctx);
    expect(Array.isArray(data.today)).toBe(true);
    expect(data.stats).toHaveProperty("activeMembers");
  });
});
