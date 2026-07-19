import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { resolvePublicStudio, listPublicStudios } from "./public-studio";

const NOW = new Date();

describe("public-studio service", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });

  describe("resolvePublicStudio", () => {
    it("resolves a studio by slug and returns classes", async () => {
      const result = await resolvePublicStudio("riverbank");
      expect(result).not.toBeNull();
      expect(result?.studio.name).toBe("Riverbank Movement");
      expect(result?.studio.slug).toBe("riverbank");
      expect(Array.isArray(result?.classes)).toBe(true);
    });

    it("returns null for an unknown slug", async () => {
      const result = await resolvePublicStudio("nonexistent");
      expect(result).toBeNull();
    });

    it("returns classes with instructor, startsAt, and endsAt", async () => {
      const result = await resolvePublicStudio("riverbank");
      if (result?.classes.length) {
        const cls = result.classes[0];
        expect(cls.id).toBeTruthy();
        expect(cls.name).toBeTruthy();
        expect(cls.instructor).toBeTruthy();
        expect(cls.startsAt).toBeTruthy();
        expect(cls.endsAt).toBeTruthy();
      }
    });
  });

  describe("listPublicStudios", () => {
    it("lists all studios", async () => {
      const studios = await listPublicStudios();
      expect(Array.isArray(studios)).toBe(true);
      expect(studios.length).toBeGreaterThan(0);
    });

    it("includes studio with slug", async () => {
      const studios = await listPublicStudios();
      expect(studios[0].slug).toBeTruthy();
    });
  });
});
