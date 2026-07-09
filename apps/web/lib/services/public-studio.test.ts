import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listPublicStudios, resolvePublicStudio } from "./public-studio";

// resolvePublicStudio filters against the real clock (`new Date()`), so the
// seed must be anchored there too — a fixed past NOW would make every seeded
// session look like it's already happened.
const NOW = new Date();

describe("resolvePublicStudio", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("resolves the studio and its upcoming classes by slug", async () => {
    const data = await resolvePublicStudio("riverbank");
    expect(data?.studio.name).toBe("Riverbank Movement");
    expect(data?.classes.length).toBeGreaterThan(0);
    for (const cls of data?.classes ?? []) {
      expect(cls.name).toBeTruthy();
      expect(cls.instructor).toBeTruthy();
      expect(new Date(cls.startsAt).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("only returns future sessions, ordered by start time", async () => {
    const data = await resolvePublicStudio("riverbank");
    const startTimes = (data?.classes ?? []).map((cls) => cls.startsAt);
    expect(startTimes).toEqual([...startTimes].sort());
  });

  it("returns null for a slug that matches no studio", async () => {
    expect(await resolvePublicStudio("does-not-exist")).toBeNull();
  });
});

describe("listPublicStudios", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists every seeded studio", async () => {
    const studios = await listPublicStudios();
    expect(studios.map((s) => s.slug)).toEqual(["riverbank"]);
  });
});
