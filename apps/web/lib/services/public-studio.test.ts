import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";
import { resolvePublicStudio, listPublicStudios } from "./public-studio";

describe("Public Studio Service", () => {
  beforeEach(() => {
    const seed = buildSeed();
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  describe("resolvePublicStudio", () => {
    it("returns studio with upcoming classes when slug matches", async () => {
      const result = await resolvePublicStudio("riverbank");

      expect(result).not.toBeNull();
      expect(result?.studio.name).toBe("Riverbank Movement");
      expect(result?.studio.slug).toBe("riverbank");
      expect(result?.classes).toBeDefined();
      expect(Array.isArray(result?.classes)).toBe(true);
    });

    it("includes class name, startsAt, and instructor", async () => {
      const result = await resolvePublicStudio("riverbank");

      if (result && result.classes.length > 0) {
        const cls = result.classes[0];
        expect(cls.name).toBeDefined();
        expect(cls.startsAt).toBeDefined();
        expect(cls.instructor).toBeDefined();
        expect(cls.endsAt).toBeDefined();
      }
    });

    it("returns null when slug does not match", async () => {
      const result = await resolvePublicStudio("unknown");
      expect(result).toBeNull();
    });

    it("filters to upcoming classes only", async () => {
      const result = await resolvePublicStudio("riverbank");

      if (result) {
        const now = new Date();
        result.classes.forEach((cls) => {
          const classTime = new Date(cls.startsAt);
          expect(classTime.getTime()).toBeGreaterThanOrEqual(now.getTime());
        });
      }
    });
  });

  describe("listPublicStudios", () => {
    it("returns all studios", async () => {
      const studios = await listPublicStudios();

      expect(Array.isArray(studios)).toBe(true);
      expect(studios.length).toBeGreaterThan(0);
    });

    it("includes the seeded studio", async () => {
      const studios = await listPublicStudios();

      const riverbank = studios.find((s) => s.slug === "riverbank");
      expect(riverbank).toBeDefined();
      expect(riverbank?.name).toBe("Riverbank Movement");
    });
  });
});
