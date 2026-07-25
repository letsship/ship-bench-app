import { describe, it, expect } from "vitest";
import { buildSeed } from "./db/seed-data";
import { studioMetadata, studioEventsJsonLd, publicStudioUrl } from "./seo";

describe("SEO Builders", () => {
  const seed = buildSeed();
  const studio = seed.studio;
  const classes = seed.sessions.slice(0, 2).map((session) => ({
    id: session.id,
    name: "Yoga",
    instructor: session.instructor,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  }));

  describe("studioMetadata", () => {
    it("includes studio name in title", () => {
      const metadata = studioMetadata(studio);
      expect(metadata.title).toContain(studio.name);
    });

    it("includes studio name in description", () => {
      const metadata = studioMetadata(studio);
      expect(metadata.description).toContain(studio.name);
    });

    it("sets robots to index and follow", () => {
      const metadata = studioMetadata(studio);
      expect(metadata.robots?.index).toBe(true);
      expect(metadata.robots?.follow).toBe(true);
    });

    it("includes canonical URL with studio slug", () => {
      const metadata = studioMetadata(studio);
      expect(metadata.alternates?.canonical).toContain(`/s/${studio.slug}`);
    });

    it("includes Open Graph tags", () => {
      const metadata = studioMetadata(studio);
      expect(metadata.openGraph?.title).toContain(studio.name);
      expect(metadata.openGraph?.description).toContain(studio.name);
      expect(metadata.openGraph?.type).toBe("website");
      expect(metadata.openGraph?.url).toContain(`/s/${studio.slug}`);
    });

    it("includes Twitter card tags", () => {
      const metadata = studioMetadata(studio);
      expect(metadata.twitter?.card).toBe("summary");
      expect(metadata.twitter?.title).toContain(studio.name);
      expect(metadata.twitter?.description).toContain(studio.name);
    });
  });

  describe("studioEventsJsonLd", () => {
    it("creates one Event per class", () => {
      const events = studioEventsJsonLd(studio, classes);
      expect(events).toHaveLength(classes.length);
    });

    it("includes required Event fields", () => {
      const events = studioEventsJsonLd(studio, classes);
      events.forEach((event, i) => {
        expect(event["@context"]).toBe("https://schema.org");
        expect(event["@type"]).toBe("Event");
        expect(event.name).toBe(classes[i].name);
        expect(event.startDate).toBe(classes[i].startsAt);
        expect(event.endDate).toBe(classes[i].endsAt);
      });
    });

    it("includes location with studio name", () => {
      const events = studioEventsJsonLd(studio, classes);
      events.forEach((event) => {
        expect(event.location).toBeDefined();
        expect(event.location["@type"]).toBe("Place");
        expect(event.location.name).toBe(studio.name);
      });
    });

    it("returns empty array when no classes", () => {
      const events = studioEventsJsonLd(studio, []);
      expect(events).toHaveLength(0);
    });
  });

  describe("publicStudioUrl", () => {
    it("returns absolute URL with studio slug", () => {
      const url = publicStudioUrl(studio.slug);
      expect(url).toContain(`/s/${studio.slug}`);
      expect(url).toMatch(/^https?:\/\//);
    });
  });
});
