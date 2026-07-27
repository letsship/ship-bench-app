import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { resolvePublicStudio } from "./public-studio";

const NOW = new Date("2026-07-05T12:00:00.000Z");

describe("public studio service", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns studio and upcoming sessions for a known slug", async () => {
    const data = await resolvePublicStudio("riverbank");
    expect(data).not.toBeNull();
    expect(data?.studio.name).toBe("Riverbank Movement");
    expect(data?.studio.slug).toBe("riverbank");
    expect(Array.isArray(data?.classes)).toBe(true);
  });

  it("returns null for an unknown slug", async () => {
    const data = await resolvePublicStudio("unknown-slug");
    expect(data).toBeNull();
  });

  it("returns classes with classTypeName, startsAt, and instructor", async () => {
    const data = await resolvePublicStudio("riverbank");
    if (!data) throw new Error("Expected data");
    expect(data.classes.length).toBeGreaterThan(0);
    data.classes.forEach((cls) => {
      expect(cls).toHaveProperty("id");
      expect(cls).toHaveProperty("name");
      expect(cls).toHaveProperty("instructor");
      expect(cls).toHaveProperty("startsAt");
      expect(cls).toHaveProperty("endsAt");
    });
  });
});
