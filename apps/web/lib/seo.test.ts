import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import { studioEventsJsonLd, studioMetadata } from "@/lib/seo";
import type { PublicClass } from "@/lib/services/public-studio";

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
    startsAt: "2026-04-01T07:00:00.000Z",
    endsAt: "2026-04-01T08:00:00.000Z",
  },
  {
    id: "c2",
    name: "Evening Wheel Throwing",
    instructor: "Priya Nair",
    startsAt: "2026-04-02T18:00:00.000Z",
    endsAt: "2026-04-02T19:30:00.000Z",
  },
];

describe("studioMetadata", () => {
  it("names the studio in the title and description", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.title).toBe("Riverbank Movement");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("sets a canonical URL matching the studio's public page", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
  });

  it("sets Open Graph title, description, and type", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.openGraph?.title).toBe("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("sets a Twitter card", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toBe("Riverbank Movement");
  });
});

describe("studioEventsJsonLd", () => {
  it("emits one schema.org Event per upcoming class", () => {
    const events = studioEventsJsonLd(studio, classes);
    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
    }
  });

  it("includes name, startDate, and location for each event", () => {
    const [event] = studioEventsJsonLd(studio, classes);
    expect(event.name).toBe("Sunrise Flow");
    expect(event.startDate).toBe("2026-04-01T07:00:00.000Z");
    expect(event.location).toEqual({ "@type": "Place", name: "Riverbank Movement" });
  });

  it("returns an empty array when there are no upcoming classes", () => {
    expect(studioEventsJsonLd(studio, [])).toEqual([]);
  });
});
