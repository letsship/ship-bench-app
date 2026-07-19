import { describe, expect, it } from "vitest";
import { buildEventJsonLd, buildStudioMetadata, siteUrl, studioUrl } from "./seo";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

const NOW = new Date().toISOString();

const studio: Studio = {
  id: "s1",
  name: "Yoga Studio",
  slug: "yoga-studio",
  timezone: "Europe/Amsterdam",
  createdAt: NOW,
};

const classes: PublicClass[] = [
  {
    id: "cs1",
    name: "Morning Yoga",
    instructor: "Alice",
    startsAt: "2026-07-20T08:00:00Z",
    endsAt: "2026-07-20T09:00:00Z",
  },
  {
    id: "cs2",
    name: "Evening Flow",
    instructor: "Bob",
    startsAt: "2026-07-20T18:00:00Z",
    endsAt: "2026-07-20T19:00:00Z",
  },
];

describe("seo builders", () => {
  describe("siteUrl", () => {
    it("uses NEXT_PUBLIC_SITE_URL when set", () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      expect(siteUrl()).toBe("https://example.com");
      process.env.NEXT_PUBLIC_SITE_URL = original;
    });

    it("falls back to localhost:3000 when not set", () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(siteUrl()).toBe("http://localhost:3000");
      process.env.NEXT_PUBLIC_SITE_URL = original;
    });
  });

  describe("studioUrl", () => {
    it("builds a complete studio URL from slug", () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      expect(studioUrl("yoga-studio")).toBe("https://example.com/s/yoga-studio");
      process.env.NEXT_PUBLIC_SITE_URL = original;
    });
  });

  describe("buildStudioMetadata", () => {
    it("creates metadata with studio name in title", () => {
      const metadata = buildStudioMetadata(studio, classes);
      expect(metadata.title).toContain("Yoga Studio");
    });

    it("creates metadata with studio name in description", () => {
      const metadata = buildStudioMetadata(studio, classes);
      expect(metadata.description).toContain("Yoga Studio");
    });

    it("sets index and follow to true", () => {
      const metadata = buildStudioMetadata(studio, classes);
      expect(metadata.robots?.index).toBe(true);
      expect(metadata.robots?.follow).toBe(true);
    });

    it("includes OpenGraph tags", () => {
      const metadata = buildStudioMetadata(studio, classes);
      expect(metadata.openGraph?.title).toContain("Yoga Studio");
      expect(metadata.openGraph?.description).toBeTruthy();
      expect(metadata.openGraph?.type).toBe("website");
      expect(metadata.openGraph?.url).toContain(studio.slug);
    });

    it("includes Twitter card tags", () => {
      const metadata = buildStudioMetadata(studio, classes);
      expect(metadata.twitter?.card).toBe("summary_large_image");
      expect(metadata.twitter?.title).toContain("Yoga Studio");
      expect(metadata.twitter?.description).toBeTruthy();
    });

    it("includes canonical URL", () => {
      const metadata = buildStudioMetadata(studio, classes);
      expect(metadata.alternates?.canonical).toContain(studio.slug);
    });
  });

  describe("buildEventJsonLd", () => {
    it("creates one Event per class", () => {
      const events = buildEventJsonLd(studio, classes);
      expect(events).toHaveLength(2);
    });

    it("includes name, startDate, and location for each event", () => {
      const events = buildEventJsonLd(studio, classes);
      events.forEach((event, idx) => {
        expect(event.name).toBe(classes[idx].name);
        expect(event.startDate).toBe(classes[idx].startsAt);
        expect(event.location.name).toBe(studio.name);
      });
    });

    it("uses correct schema.org types", () => {
      const events = buildEventJsonLd(studio, classes);
      events.forEach((event) => {
        expect(event["@context"]).toBe("https://schema.org");
        expect(event["@type"]).toBe("Event");
        expect(event.location["@type"]).toBe("Place");
      });
    });
  });
});
