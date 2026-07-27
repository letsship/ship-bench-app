import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { buildStudioJsonLd, buildStudioMetadata } from "./seo";

describe("public studio SEO builders", () => {
  const studio: Studio = {
    id: "studio-1",
    name: "Test Studio",
    slug: "test-studio",
    timezone: "UTC",
    createdAt: "2026-01-01T00:00:00Z",
  };

  const siteUrl = "https://example.com";

  it("buildStudioMetadata includes studio name in title", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.title).toBe("Test Studio");
  });

  it("buildStudioMetadata includes studio name in description", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.description).toContain("Test Studio");
  });

  it("buildStudioMetadata sets robots to indexable", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("buildStudioMetadata includes og:title and og:description", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.openGraph?.title).toBe("Test Studio");
    expect(metadata.openGraph?.description).toContain("Test Studio");
  });

  it("buildStudioMetadata sets og:type to website", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("buildStudioMetadata includes Twitter card", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toBe("Test Studio");
  });

  it("buildStudioMetadata sets canonical URL", () => {
    const metadata = buildStudioMetadata(studio, [], siteUrl);
    expect(metadata.alternates?.canonical).toBe(`${siteUrl}/s/${studio.slug}`);
  });

  it("buildStudioJsonLd emits one Event per class", () => {
    const classes: PublicClass[] = [
      {
        id: "class-1",
        name: "Yoga",
        instructor: "John",
        startsAt: "2026-01-01T10:00:00Z",
        endsAt: "2026-01-01T11:00:00Z",
      },
      {
        id: "class-2",
        name: "Pilates",
        instructor: "Jane",
        startsAt: "2026-01-01T12:00:00Z",
        endsAt: "2026-01-01T13:00:00Z",
      },
    ];
    const jsonLd = buildStudioJsonLd(studio, classes);
    expect(jsonLd).toHaveLength(2);
  });

  it("buildStudioJsonLd Event has name, startDate, and location", () => {
    const classes: PublicClass[] = [
      {
        id: "class-1",
        name: "Yoga",
        instructor: "John",
        startsAt: "2026-01-01T10:00:00Z",
        endsAt: "2026-01-01T11:00:00Z",
      },
    ];
    const jsonLd = buildStudioJsonLd(studio, classes);
    const event = jsonLd[0];
    expect(event.name).toBe("Yoga");
    expect(event.startDate).toBe("2026-01-01T10:00:00Z");
    expect(event.location.name).toBe("Test Studio");
    expect(event.location["@type"]).toBe("Place");
  });

  it("buildStudioJsonLd has correct schema.org context and type", () => {
    const classes: PublicClass[] = [
      {
        id: "class-1",
        name: "Yoga",
        instructor: "John",
        startsAt: "2026-01-01T10:00:00Z",
        endsAt: "2026-01-01T11:00:00Z",
      },
    ];
    const jsonLd = buildStudioJsonLd(studio, classes);
    const event = jsonLd[0];
    expect(event["@context"]).toBe("https://schema.org");
    expect(event["@type"]).toBe("Event");
  });

  it("buildStudioJsonLd returns empty array for no classes", () => {
    const jsonLd = buildStudioJsonLd(studio, []);
    expect(jsonLd).toEqual([]);
  });
});
