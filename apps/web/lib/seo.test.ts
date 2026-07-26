import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { studioEventsJsonLd, studioMetadata } from "./seo";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank-movement",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "cls1",
    name: "Morning Vinyasa",
    instructor: "Amara Okafor",
    startsAt: "2026-08-01T08:00:00.000Z",
    endsAt: "2026-08-01T09:00:00.000Z",
  },
  {
    id: "cls2",
    name: "Evening Flow",
    instructor: "Jonah Reyes",
    startsAt: "2026-08-02T18:00:00.000Z",
    endsAt: "2026-08-02T19:00:00.000Z",
  },
];

describe("studioMetadata", () => {
  it("names the studio in the title and description, not a hardcoded 'Studio'", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.title).toContain(studio.name);
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain(studio.name);
  });

  it("includes Open Graph and Twitter card tags", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.openGraph?.title).toContain(studio.name);
    expect(metadata.openGraph?.description).toContain(studio.name);
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });

  it("sets a canonical URL pointing at /s/<slug>", () => {
    const metadata = studioMetadata(studio);
    expect(metadata.alternates?.canonical).toContain(`/s/${studio.slug}`);
  });
});

describe("studioEventsJsonLd", () => {
  it("returns one schema.org Event per class with name, startDate, and location", () => {
    const events = studioEventsJsonLd(studio, classes);
    expect(events).toHaveLength(classes.length);
    events.forEach((event, index) => {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBe(classes[index].name);
      expect(event.startDate).toBe(classes[index].startsAt);
      expect(event.location).toMatchObject({ name: studio.name });
    });
  });

  it("returns an empty array when there are no upcoming classes", () => {
    expect(studioEventsJsonLd(studio, [])).toEqual([]);
  });
});
