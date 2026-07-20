import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import {
  resolvePublicStudio,
  buildStudioMetadata,
  buildEventsJsonLd,
  publicBaseUrl,
} from "@/lib/services/public-studio";

// Anchored to the real clock: resolvePublicStudio uses new Date() internally,
// so the seed must be based on the actual current date to match.
const NOW = new Date();

describe("public-studio service", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  describe("resolvePublicStudio", () => {
    it("returns the studio and its upcoming classes when slug matches", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      expect(data?.studio.name).toBe("Riverbank Movement");
      expect(data?.studio.slug).toBe("riverbank");
      expect(Array.isArray(data?.classes)).toBe(true);
      expect(data?.classes.length).toBeGreaterThan(0);
    });

    it("includes only upcoming classes (from now onwards)", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      data?.classes.forEach((cls) => {
        expect(new Date(cls.startsAt).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
      });
    });

    it("exposes class name, startDate, and instructor", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const firstClass = data?.classes[0];
      expect(firstClass).toHaveProperty("name");
      expect(firstClass).toHaveProperty("startsAt");
      expect(firstClass).toHaveProperty("instructor");
      expect(typeof firstClass?.name).toBe("string");
      expect(typeof firstClass?.startsAt).toBe("string");
      expect(typeof firstClass?.instructor).toBe("string");
    });

    it("returns null when slug does not match any studio", async () => {
      const data = await resolvePublicStudio("does-not-exist");
      expect(data).toBeNull();
    });
  });

  describe("buildStudioMetadata", () => {
    it("includes studio name in title and description", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const metadata = buildStudioMetadata(data!.studio, publicBaseUrl());
      expect(metadata.title).toBe("Riverbank Movement");
      expect(metadata.description).toContain("Riverbank Movement");
    });

    it("includes canonical URL ending with /s/slug", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const baseUrl = "https://example.com";
      const metadata = buildStudioMetadata(data!.studio, baseUrl);
      expect(metadata.alternates?.canonical).toBe("https://example.com/s/riverbank");
    });

    it("includes Open Graph tags", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const baseUrl = "https://example.com";
      const metadata = buildStudioMetadata(data!.studio, baseUrl);
      expect(metadata.openGraph?.title).toBe("Riverbank Movement");
      expect(metadata.openGraph?.description).toContain("Riverbank Movement");
      expect(metadata.openGraph?.type).toBe("website");
    });

    it("includes Twitter card tags", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const baseUrl = "https://example.com";
      const metadata = buildStudioMetadata(data!.studio, baseUrl);
      expect(metadata.twitter?.card).toBe("summary_large_image");
      expect(metadata.twitter?.title).toBe("Riverbank Movement");
    });
  });

  describe("buildEventsJsonLd", () => {
    it("returns one Event per class", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const events = buildEventsJsonLd(data!.studio, data!.classes);
      expect(events.length).toBe(data!.classes.length);
    });

    it("includes name, startDate, and location for each event", async () => {
      const data = await resolvePublicStudio("riverbank");
      expect(data).not.toBeNull();
      const events = buildEventsJsonLd(data!.studio, data!.classes);
      events.forEach((event) => {
        expect(event["@context"]).toBe("https://schema.org");
        expect(event["@type"]).toBe("Event");
        expect(typeof event.name).toBe("string");
        expect(typeof event.startDate).toBe("string");
        expect(event.location["@type"]).toBe("Place");
        expect(event.location.name).toBe("Riverbank Movement");
      });
    });
  });
});
