import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import {
  buildStudioEventsJsonLd,
  buildStudioMetadata,
  sitemapUrl,
  siteUrl,
  studioPath,
  studioUrl,
} from "./studio";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classes = [
  {
    id: "c1",
    name: "Vinyasa Yoga",
    instructor: "Bo",
    startsAt: "2026-02-01T09:00:00.000Z",
    endsAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "c2",
    name: "Reformer Pilates",
    instructor: "Ada",
    startsAt: "2026-02-02T18:00:00.000Z",
    endsAt: "2026-02-02T19:00:00.000Z",
  },
];

describe("seo studio builders", () => {
  it("siteUrl/studioPath/studioUrl build absolute studio URLs", () => {
    expect(studioPath("riverbank")).toBe("/s/riverbank");
    expect(studioUrl("riverbank")).toBe(`${siteUrl()}/s/riverbank`);
    expect(sitemapUrl()).toBe(`${siteUrl()}/sitemap.xml`);
  });

  it("buildStudioMetadata names the studio and never falls back to 'Studio'", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.title).toBe(studio.name);
    expect(meta.title).not.toBe("Studio");
    expect(typeof meta.description).toBe("string");
    expect(meta.description!).toContain(studio.name);
    expect(meta.description!).not.toBe("Studio");

    expect(meta.openGraph?.title).toBe(studio.name);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect(meta.openGraph?.type).toBe("website");

    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.twitter?.title).toBe(studio.name);

    expect(meta.alternates?.canonical).toBe(studioUrl(studio.slug));
  });

  it("buildStudioMetadata handles an empty class list without throwing", () => {
    const meta = buildStudioMetadata(studio, []);
    expect(meta.title).toBe(studio.name);
    expect(meta.description).toContain(studio.name);
  });

  it("buildStudioEventsJsonLd emits one Event per class with name/startDate/location", () => {
    const events = buildStudioEventsJsonLd(studio, classes);
    expect(events).toHaveLength(classes.length);
    events.forEach((event, i) => {
      expect(event["@context"]).toBe("https://schema.org");
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBe(classes[i].name);
      expect(event.startDate).toBe(classes[i].startsAt);
      expect(event.location).toEqual({ "@type": "Place", name: studio.name });
    });
  });

  it("buildStudioEventsJsonLd is empty when there are no upcoming classes", () => {
    expect(buildStudioEventsJsonLd(studio, [])).toEqual([]);
  });
});
