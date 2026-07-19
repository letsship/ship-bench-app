import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import {
  buildStudioEventJsonLd,
  buildStudioMetadata,
  canonicalFor,
  siteUrl,
} from "./studio-metadata";

describe("siteUrl", () => {
  it("returns the site URL from env or defaults to localhost", () => {
    const url = siteUrl();
    expect(url).toMatch(/^https?:\/\/.+/);
  });
});

describe("canonicalFor", () => {
  it("builds the canonical URL for a studio slug", () => {
    const canonical = canonicalFor("my-studio");
    expect(canonical).toBe(`${siteUrl()}/s/my-studio`);
  });
});

describe("buildStudioMetadata", () => {
  const studio: Studio = {
    id: "s1",
    name: "Yoga Flow",
    slug: "yoga-flow",
    timezone: "America/New_York",
    createdAt: "2024-01-01T00:00:00Z",
  };

  it("includes the studio name in the title", () => {
    const metadata = buildStudioMetadata(studio, []);
    expect(metadata.title).toContain("Yoga Flow");
  });

  it("includes OpenGraph tags with studio name", () => {
    const metadata = buildStudioMetadata(studio, []);
    expect(metadata.openGraph?.title).toContain("Yoga Flow");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.openGraph?.url).toBe(canonicalFor("yoga-flow"));
  });

  it("includes Twitter card tags", () => {
    const metadata = buildStudioMetadata(studio, []);
    expect(metadata.twitter?.card).toBe("summary_large_image");
    expect(metadata.twitter?.title).toContain("Yoga Flow");
  });

  it("includes a canonical URL", () => {
    const metadata = buildStudioMetadata(studio, []);
    expect(metadata.alternates?.canonical).toBe(canonicalFor("yoga-flow"));
  });

  it("sets robots to allow indexing", () => {
    const metadata = buildStudioMetadata(studio, []);
    expect(metadata.robots?.index).toBe(true);
    expect(metadata.robots?.follow).toBe(true);
  });

  it("includes the number of upcoming classes in description when there are classes", () => {
    const classes: PublicClass[] = [
      {
        id: "c1",
        name: "Morning Yoga",
        instructor: "Jane",
        startsAt: "2024-01-15T08:00:00Z",
        endsAt: "2024-01-15T09:00:00Z",
      },
      {
        id: "c2",
        name: "Evening Yoga",
        instructor: "John",
        startsAt: "2024-01-15T18:00:00Z",
        endsAt: "2024-01-15T19:00:00Z",
      },
    ];
    const metadata = buildStudioMetadata(studio, classes);
    expect(metadata.description).toContain("2 upcoming classes");
  });

  it("has a generic description when there are no classes", () => {
    const metadata = buildStudioMetadata(studio, []);
    expect(metadata.description).toContain("Yoga Flow");
  });
});

describe("buildStudioEventJsonLd", () => {
  const studio: Studio = {
    id: "s1",
    name: "Yoga Flow",
    slug: "yoga-flow",
    timezone: "America/New_York",
    createdAt: "2024-01-01T00:00:00Z",
  };

  it("returns an array of Event objects", () => {
    const classes: PublicClass[] = [
      {
        id: "c1",
        name: "Morning Yoga",
        instructor: "Jane",
        startsAt: "2024-01-15T08:00:00Z",
        endsAt: "2024-01-15T09:00:00Z",
      },
    ];
    const events = buildStudioEventJsonLd(studio, classes);
    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(1);
  });

  it("includes name, startDate, and location in each event", () => {
    const classes: PublicClass[] = [
      {
        id: "c1",
        name: "Morning Yoga",
        instructor: "Jane",
        startsAt: "2024-01-15T08:00:00Z",
        endsAt: "2024-01-15T09:00:00Z",
      },
    ];
    const events = buildStudioEventJsonLd(studio, classes);
    const event = events[0];

    expect(event["@context"]).toBe("https://schema.org");
    expect(event["@type"]).toBe("Event");
    expect(event.name).toBe("Morning Yoga");
    expect(event.startDate).toBe("2024-01-15T08:00:00Z");
    expect(event.location["@type"]).toBe("Place");
    expect(event.location.name).toBe("Yoga Flow");
  });

  it("returns an empty array when there are no classes", () => {
    const events = buildStudioEventJsonLd(studio, []);
    expect(events).toHaveLength(0);
  });
});
