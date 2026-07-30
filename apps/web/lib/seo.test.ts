import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { serializeJsonLd, studioEventsJsonLd, studioPageMetadata } from "./seo";

const SITE = "https://studiobook.example";

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
    name: "Vinyasa Flow",
    instructor: "Nina Halberg",
    startsAt: "2026-04-01T08:00:00.000Z",
    endsAt: "2026-04-01T09:00:00.000Z",
  },
  {
    id: "c2",
    name: "Yin & Restore",
    instructor: "Tomas Vidal",
    startsAt: "2026-04-02T17:30:00.000Z",
    endsAt: "2026-04-02T18:30:00.000Z",
  },
];

// The helpers read NEXT_PUBLIC_SITE_URL at call time, so pin it for absolute
// URL assertions and restore it afterwards.
const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
});
afterEach(() => {
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
});

describe("studioPageMetadata", () => {
  it("names the real studio rather than a generic 'Studio' title", () => {
    const meta = studioPageMetadata(studio);
    expect(meta.title).toContain("Riverbank Movement");
    expect(meta.title).not.toBe("Studio");
    expect(meta.description).toContain("Riverbank Movement");
    expect((meta.description ?? "").length).toBeGreaterThan(50);
  });

  it("sets Open Graph title, description and type", () => {
    const og = studioPageMetadata(studio).openGraph as unknown as {
      title?: string;
      description?: string;
      type?: string;
      url?: string;
    };
    expect(og.title).toContain("Riverbank Movement");
    expect(og.description).toContain("Riverbank Movement");
    expect(og.type).toBe("website");
    expect(og.url).toBe(`${SITE}/s/riverbank`);
  });

  it("sets Twitter card tags", () => {
    const twitter = studioPageMetadata(studio).twitter as unknown as {
      card?: string;
      title?: string;
      description?: string;
    };
    expect(twitter.card).toBe("summary");
    expect(twitter.title).toContain("Riverbank Movement");
    expect(twitter.description).toContain("Riverbank Movement");
  });

  it("sets a canonical URL for the studio's public page", () => {
    const meta = studioPageMetadata(studio);
    expect(meta.alternates?.canonical).toBe(`${SITE}/s/riverbank`);
  });

  it("does not mark the page noindex", () => {
    expect(studioPageMetadata(studio).robots).toBeUndefined();
  });
});

describe("studioEventsJsonLd", () => {
  it("emits one schema.org Event per upcoming class", () => {
    const events = studioEventsJsonLd(studio, classes) as Record<string, unknown>[];
    expect(events).toHaveLength(2);
    expect(events.map((event) => event["@type"])).toEqual(["Event", "Event"]);
    expect(events.map((event) => event.name)).toEqual(["Vinyasa Flow", "Yin & Restore"]);
  });

  it("gives every event a name, startDate and location", () => {
    const events = studioEventsJsonLd(studio, classes) as Record<string, unknown>[];
    for (const event of events) {
      expect(event["@context"]).toBe("https://schema.org");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.location).toEqual({ "@type": "Place", name: "Riverbank Movement" });
    }
  });

  it("carries the class start time and instructor through", () => {
    const [first] = studioEventsJsonLd(studio, classes) as Record<string, unknown>[];
    expect(first.startDate).toBe("2026-04-01T08:00:00.000Z");
    expect(first.performer).toEqual({ "@type": "Person", name: "Nina Halberg" });
  });

  it("emits nothing when the studio has no upcoming classes", () => {
    expect(studioEventsJsonLd(studio, [])).toEqual([]);
  });
});

describe("serializeJsonLd", () => {
  // Class names, instructors and the studio name are free-form input that ends
  // up inside a <script> on a page anonymous visitors can open, so a name
  // carrying markup must not be able to terminate the element.
  const hostile: PublicClass[] = [
    {
      id: "c9",
      name: '</script><img src=x onerror="alert(1)">',
      instructor: "<b>Mallory</b>",
      startsAt: "2026-04-03T08:00:00.000Z",
      endsAt: "2026-04-03T09:00:00.000Z",
    },
  ];

  it("leaves no '<' that could close the surrounding script element", () => {
    const html = serializeJsonLd(studioEventsJsonLd(studio, hostile));
    expect(html).not.toContain("<");
    expect(html).not.toMatch(/<\/script/i);
  });

  it("keeps the escaped payload parseable back to the original values", () => {
    const html = serializeJsonLd(studioEventsJsonLd(studio, hostile));
    const [event] = JSON.parse(html) as Record<string, unknown>[];
    expect(event.name).toBe('</script><img src=x onerror="alert(1)">');
    expect(event.performer).toEqual({ "@type": "Person", name: "<b>Mallory</b>" });
  });

  it("escapes '<' wherever it appears, including in the studio name", () => {
    const html = serializeJsonLd(studioEventsJsonLd({ ...studio, name: "<Riverbank>" }, classes));
    expect(html).not.toContain("<");
    expect(JSON.parse(html)[0].location).toEqual({ "@type": "Place", name: "<Riverbank>" });
  });

  it("serializes ordinary payloads unchanged", () => {
    expect(serializeJsonLd({ a: 1, b: "plain" })).toBe('{"a":1,"b":"plain"}');
  });
});
