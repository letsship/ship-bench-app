import { describe, expect, it } from "vitest";
import type { PublicStudio } from "@/lib/services/public-studio";
import { buildStudioEventsJsonLd, studioMetadata } from "./seo";

const STUDIO: PublicStudio = {
  studio: {
    id: "studio-1",
    name: "Riverbank Movement",
    slug: "riverbank",
    timezone: "Europe/Amsterdam",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  classes: [
    {
      id: "class-1",
      name: "Vinyasa Flow",
      instructor: "Noor",
      startsAt: "2026-08-01T08:00:00.000Z",
      endsAt: "2026-08-01T09:00:00.000Z",
    },
    {
      id: "class-2",
      name: "Reformer Pilates",
      instructor: "Sanne",
      startsAt: "2026-08-02T08:00:00.000Z",
      endsAt: "2026-08-02T09:00:00.000Z",
    },
  ],
};

describe("studioMetadata", () => {
  it("names the actual studio in the title and description, not a generic placeholder", () => {
    const metadata = studioMetadata(STUDIO, "riverbank");
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("sets a canonical URL for the studio's slug", () => {
    const metadata = studioMetadata(STUDIO, "riverbank");
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
  });

  it("marks the page indexable", () => {
    const metadata = studioMetadata(STUDIO, "riverbank");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("includes Open Graph title, description, and type", () => {
    const metadata = studioMetadata(STUDIO, "riverbank");
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("includes a Twitter card", () => {
    const metadata = studioMetadata(STUDIO, "riverbank");
    expect(metadata.twitter?.card).toBe("summary");
  });
});

describe("buildStudioEventsJsonLd", () => {
  it("returns one schema.org Event per upcoming class with name, startDate, and location", () => {
    const events = buildStudioEventsJsonLd(STUDIO);
    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location).toMatchObject({ "@type": "Place", name: "Riverbank Movement" });
    }
    expect(events[0].name).toBe("Vinyasa Flow");
    expect(events[0].startDate).toBe("2026-08-01T08:00:00.000Z");
  });

  it("returns an empty array when there are no upcoming classes", () => {
    expect(buildStudioEventsJsonLd({ ...STUDIO, classes: [] })).toEqual([]);
  });
});
