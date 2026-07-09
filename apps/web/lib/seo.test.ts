import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { buildStudioEventJsonLd, buildStudioMetadata, getSiteUrl } from "@/lib/seo";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "c1",
    name: "Sunrise Flow",
    instructor: "Amara Okafor",
    startsAt: "2026-03-16T07:00:00.000Z",
    endsAt: "2026-03-16T08:00:00.000Z",
  },
  {
    id: "c2",
    name: "Evening Strength",
    instructor: "Theo Marsh",
    startsAt: "2026-03-16T18:00:00.000Z",
    endsAt: "2026-03-16T19:00:00.000Z",
  },
];

describe("getSiteUrl", () => {
  it("returns a non-empty absolute origin", () => {
    expect(getSiteUrl()).toMatch(/^https?:\/\//);
  });
});

describe("buildStudioMetadata", () => {
  it("names the actual studio, not the literal word 'Studio'", () => {
    const metadata = buildStudioMetadata(studio);
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("is indexable", () => {
    const metadata = buildStudioMetadata(studio);
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("sets a canonical URL that includes the slug", () => {
    const metadata = buildStudioMetadata(studio);
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
  });

  it("populates Open Graph fields", () => {
    const metadata = buildStudioMetadata(studio);
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("populates a Twitter card", () => {
    const metadata = buildStudioMetadata(studio);
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toContain("Riverbank Movement");
  });
});

describe("buildStudioEventJsonLd", () => {
  it("emits one schema.org Event per upcoming class with name, startDate, and location", () => {
    const events = buildStudioEventJsonLd(studio, classes);
    expect(events).toHaveLength(2);
    for (const [index, event] of events.entries()) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBe(classes[index].name);
      expect(event.startDate).toBe(classes[index].startsAt);
      expect(event.location).toEqual({ "@type": "Place", name: studio.name });
    }
  });

  it("returns an empty array when there are no upcoming classes", () => {
    expect(buildStudioEventJsonLd(studio, [])).toEqual([]);
  });
});
