import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import { buildStudioEventJsonLd, buildStudioMetadata } from "@/lib/seo";
import type { PublicClass } from "@/lib/services/public-studio";

const studio: Studio = {
  id: "studio-1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2025-09-15T00:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "session-1",
    name: "Vinyasa Flow",
    instructor: "Noor",
    startsAt: "2026-03-16T08:00:00.000Z",
    endsAt: "2026-03-16T09:00:00.000Z",
  },
  {
    id: "session-2",
    name: "Wheel Throwing",
    instructor: "Priya",
    startsAt: "2026-03-16T17:00:00.000Z",
    endsAt: "2026-03-16T18:00:00.000Z",
  },
];

const SITE = "https://studiobook.example";

describe("buildStudioMetadata", () => {
  it("names the studio in title and description", () => {
    const metadata = buildStudioMetadata(studio, classes, SITE);
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("sets Open Graph, Twitter card, and canonical URL", () => {
    const metadata = buildStudioMetadata(studio, classes, SITE);
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph).toMatchObject({ type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.twitter?.title).toContain("Riverbank Movement");
    expect(metadata.alternates?.canonical).toBe(`${SITE}/s/riverbank`);
  });

  it("still describes the studio when no classes are upcoming", () => {
    const metadata = buildStudioMetadata(studio, [], SITE);
    expect(metadata.description).toContain("Riverbank Movement");
  });
});

describe("buildStudioEventJsonLd", () => {
  it("emits one schema.org Event per upcoming class", () => {
    const events = buildStudioEventJsonLd(studio, classes, SITE);
    expect(events).toHaveLength(2);
    for (const [index, event] of events.entries()) {
      expect(event["@context"]).toBe("https://schema.org");
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBe(classes[index].name);
      expect(event.startDate).toBe(classes[index].startsAt);
      expect(event.location).toMatchObject({ "@type": "Place", name: "Riverbank Movement" });
      expect(event.performer).toMatchObject({ name: classes[index].instructor });
    }
  });
});
