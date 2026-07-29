import { afterEach, describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import {
  publicStudioPath,
  siteUrl,
  studioEventsJsonLd,
  studioMetadata,
  studioSitemapEntries,
} from "@/lib/seo";
import type { PublicClass } from "@/lib/services/public-studio";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T09:00:00.000Z",
};

const upcomingClass = (id: string, over: Partial<PublicClass> = {}): PublicClass => ({
  id,
  name: "Vinyasa Flow",
  instructor: "Noor",
  startsAt: "2026-08-03T09:00:00.000Z",
  endsAt: "2026-08-03T10:00:00.000Z",
  ...over,
});

const classes = [upcomingClass("c1"), upcomingClass("c2", { name: "Yin & Restore" })];
const BASE = "https://studiobook.example";

describe("siteUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("uses NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://book.riverbank.example/";
    expect(siteUrl()).toBe("https://book.riverbank.example");
  });
});

describe("publicStudioPath", () => {
  it("builds the /s/<slug> path", () => {
    expect(publicStudioPath("riverbank")).toBe("/s/riverbank");
  });
});

describe("studioMetadata", () => {
  const metadata = studioMetadata(studio, classes, BASE);

  it("names the studio in the title and description", () => {
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("sets Open Graph title, description, and type", () => {
    expect(metadata.openGraph).toMatchObject({
      title: expect.stringContaining("Riverbank Movement"),
      description: expect.stringContaining("Riverbank Movement"),
      type: "website",
    });
  });

  it("sets Twitter card tags", () => {
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: expect.stringContaining("Riverbank Movement"),
      description: expect.stringContaining("Riverbank Movement"),
    });
  });

  it("sets an absolute canonical URL for the public page", () => {
    expect(metadata.alternates?.canonical).toBe("https://studiobook.example/s/riverbank");
  });

  it("does not block indexing", () => {
    expect(metadata.robots).toBeUndefined();
  });
});

describe("studioEventsJsonLd", () => {
  const events = studioEventsJsonLd(studio, classes, BASE);

  it("emits one schema.org Event per upcoming class", () => {
    expect(events).toHaveLength(classes.length);
    events.forEach((event, index) => {
      expect(event["@context"]).toBe("https://schema.org");
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBe(classes[index]?.name);
    });
  });

  it("gives every event a valid ISO startDate and a location", () => {
    for (const event of events) {
      expect(Number.isNaN(Date.parse(event.startDate))).toBe(false);
      expect(new Date(event.startDate).toISOString()).toBe(event.startDate);
      expect(event.location).toMatchObject({ "@type": "Place", name: "Riverbank Movement" });
    }
  });
});

describe("studioSitemapEntries", () => {
  it("lists each public studio page as an absolute /s/<slug> URL", () => {
    const entries = studioSitemapEntries([studio], BASE);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("https://studiobook.example/s/riverbank");
  });
});
