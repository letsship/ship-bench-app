import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { siteUrl, studioMetadata, studioEventsJsonLd } from "./seo";

describe("siteUrl", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    }
  });

  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(siteUrl()).toBe("https://example.com");
  });

  it("trims trailing slash from NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    expect(siteUrl()).toBe("https://example.com");
  });

  it("falls back to localhost:3000 when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("studioMetadata", () => {
  const studio: Studio = {
    id: "s1",
    name: "Fitness Studio",
    slug: "fitness-studio",
    timezone: "America/New_York",
    createdAt: "2025-01-01T00:00:00Z",
  };

  it("includes title naming the studio", () => {
    const meta = studioMetadata(studio);
    expect(meta.title).toContain("Fitness Studio");
    expect(meta.title).toContain("class schedule");
  });

  it("includes description naming the studio", () => {
    const meta = studioMetadata(studio);
    expect(meta.description).toContain("Fitness Studio");
  });

  it("sets robots to index and follow", () => {
    const meta = studioMetadata(studio);
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("sets canonical URL to studio page", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    const meta = studioMetadata(studio);
    expect(meta.alternates?.canonical).toBe("https://example.com/s/fitness-studio");
  });

  it("sets Open Graph tags", () => {
    const meta = studioMetadata(studio);
    expect(meta.openGraph?.title).toContain("Fitness Studio");
    expect(meta.openGraph?.description).toContain("Fitness Studio");
    expect(meta.openGraph?.type).toBe("website");
    expect(meta.openGraph?.url).toContain("/s/fitness-studio");
  });

  it("sets Twitter card tags", () => {
    const meta = studioMetadata(studio);
    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.twitter?.title).toContain("Fitness Studio");
    expect(meta.twitter?.description).toContain("Fitness Studio");
  });
});

describe("studioEventsJsonLd", () => {
  const studio: Studio = {
    id: "s1",
    name: "Yoga Studio",
    slug: "yoga-studio",
    timezone: "America/New_York",
    createdAt: "2025-01-01T00:00:00Z",
  };

  it("emits one Event per class", () => {
    const classes: PublicClass[] = [
      {
        id: "c1",
        name: "Vinyasa",
        instructor: "Alice",
        startsAt: "2025-01-15T10:00:00Z",
        endsAt: "2025-01-15T11:00:00Z",
      },
      {
        id: "c2",
        name: "Yin",
        instructor: "Bob",
        startsAt: "2025-01-15T18:00:00Z",
        endsAt: "2025-01-15T19:00:00Z",
      },
    ];

    const jsonLd = studioEventsJsonLd(studio, classes);
    expect(jsonLd).toHaveLength(2);
  });

  it("includes @context and @type for each Event", () => {
    const classes: PublicClass[] = [
      {
        id: "c1",
        name: "Vinyasa",
        instructor: "Alice",
        startsAt: "2025-01-15T10:00:00Z",
        endsAt: "2025-01-15T11:00:00Z",
      },
    ];

    const jsonLd = studioEventsJsonLd(studio, classes);
    expect(jsonLd[0]["@context"]).toBe("https://schema.org");
    expect(jsonLd[0]["@type"]).toBe("Event");
  });

  it("includes name, startDate, and location", () => {
    const classes: PublicClass[] = [
      {
        id: "c1",
        name: "Vinyasa",
        instructor: "Alice",
        startsAt: "2025-01-15T10:00:00Z",
        endsAt: "2025-01-15T11:00:00Z",
      },
    ];

    const jsonLd = studioEventsJsonLd(studio, classes);
    const event = jsonLd[0];

    expect(event.name).toBe("Vinyasa");
    expect(event.startDate).toBe("2025-01-15T10:00:00Z");
    expect(event.location["@type"]).toBe("Place");
    expect(event.location.name).toBe("Yoga Studio");
  });

  it("handles empty class list", () => {
    const jsonLd = studioEventsJsonLd(studio, []);
    expect(jsonLd).toEqual([]);
  });
});
