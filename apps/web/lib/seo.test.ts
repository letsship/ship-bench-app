import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import { studioEventsJsonLd, studioMetadata } from "@/lib/seo";
import { publicStudioUrl, type PublicClass } from "@/lib/services/public-studio";

const STUDIO: Studio = {
  id: "studio-1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const CLASSES: PublicClass[] = [
  {
    id: "session-1",
    name: "Vinyasa Flow",
    instructor: "Noor",
    startsAt: "2026-03-16T08:00:00.000Z",
    endsAt: "2026-03-16T09:00:00.000Z",
  },
  {
    id: "session-2",
    name: "Reformer Pilates",
    instructor: "Sanne",
    startsAt: "2026-03-16T12:00:00.000Z",
    endsAt: "2026-03-16T13:00:00.000Z",
  },
];

describe("studioMetadata", () => {
  it("names the studio in the title and description, not a generic placeholder", () => {
    const metadata = studioMetadata(STUDIO);
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("sets a canonical URL and matching Open Graph url", () => {
    const metadata = studioMetadata(STUDIO);
    expect(metadata.alternates?.canonical).toBe(publicStudioUrl(STUDIO.slug));
    expect(metadata.openGraph?.url).toBe(publicStudioUrl(STUDIO.slug));
  });

  it("sets Open Graph type/title/description", () => {
    const metadata = studioMetadata(STUDIO);
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
  });

  it("sets a Twitter summary card", () => {
    const metadata = studioMetadata(STUDIO);
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });
});

describe("studioEventsJsonLd", () => {
  it("returns one schema.org Event per upcoming class with name/startDate/location", () => {
    const events = studioEventsJsonLd(STUDIO, CLASSES);
    expect(events).toHaveLength(2);
    for (const [index, event] of events.entries()) {
      expect(event).toMatchObject({
        "@type": "Event",
        name: CLASSES[index].name,
        startDate: CLASSES[index].startsAt,
        location: { name: STUDIO.name },
      });
    }
  });

  it("returns an empty array when there are no upcoming classes", () => {
    expect(studioEventsJsonLd(STUDIO, [])).toEqual([]);
  });
});
