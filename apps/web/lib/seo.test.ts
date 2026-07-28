import { describe, expect, it } from "vitest";
import { buildStudioJsonLd, buildStudioMetadata } from "@/lib/seo";
import type { PublicClass } from "@/lib/services/public-studio";
import type { Studio } from "@/lib/db/types";

const studio: Studio = {
  id: "studio-1",
  name: "Riverbank Yoga",
  slug: "riverbank",
  timezone: "Europe/London",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "s1",
    name: "Sunrise Flow",
    instructor: "Ada",
    startsAt: "2026-03-16T07:00:00.000Z",
    endsAt: "2026-03-16T08:00:00.000Z",
  },
  {
    id: "s2",
    name: "Evening Restore",
    instructor: "Ben",
    startsAt: "2026-03-16T18:00:00.000Z",
    endsAt: "2026-03-16T19:00:00.000Z",
  },
];

describe("buildStudioMetadata", () => {
  it("produces studio-specific title, description, social tags, and canonical", () => {
    const metadata = buildStudioMetadata(studio);
    expect(String(metadata.title)).toContain("Riverbank Yoga");
    expect(metadata.description).toContain("Riverbank Yoga");
    expect(metadata.openGraph?.title).toBe("Riverbank Yoga");
    expect(metadata.openGraph?.description).toContain("Riverbank Yoga");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toBe("Riverbank Yoga");
    expect(String(metadata.alternates?.canonical)).toMatch(/\/s\/riverbank$/);
  });

  it("does not mark the page noindex", () => {
    const metadata = buildStudioMetadata(studio);
    const robots = metadata.robots;
    if (robots && typeof robots === "object" && !Array.isArray(robots)) {
      expect(robots.index).not.toBe(false);
    }
  });
});

describe("buildStudioJsonLd", () => {
  it("emits one schema.org Event per upcoming class", () => {
    const events = buildStudioJsonLd(studio, classes);
    expect(events).toHaveLength(classes.length);
    for (const event of events) {
      expect(event["@context"]).toBe("https://schema.org");
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location.name).toBe("Riverbank Yoga");
    }
    expect(events[0].name).toBe("Sunrise Flow");
    expect(events[0].startDate).toBe("2026-03-16T07:00:00.000Z");
  });

  it("returns an empty list when there are no upcoming classes", () => {
    expect(buildStudioJsonLd(studio, [])).toEqual([]);
  });
});
