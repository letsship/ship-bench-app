import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import {
  buildRobotsMetadata,
  buildStudioEventJsonLd,
  buildStudioMetadata,
  buildStudioSitemapEntries,
  studioPageUrl,
} from "./studio-seo";

const studio: Studio = {
  id: "studio-1",
  name: "Riverbank Movement",
  slug: "riverbank-movement",
  timezone: "Europe/London",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const baseUrl = "https://studiobook.example";

describe("buildStudioMetadata", () => {
  it("builds studio-specific metadata, social tags, and a canonical URL", () => {
    const metadata = buildStudioMetadata(studio, baseUrl);

    expect(metadata.title).toContain(studio.name);
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain(studio.name);
    expect(metadata.openGraph).toMatchObject({
      title: expect.stringContaining(studio.name),
      description: expect.stringContaining(studio.name),
      type: "website",
      url: `${baseUrl}/s/${studio.slug}`,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: expect.stringContaining(studio.name),
      description: expect.stringContaining(studio.name),
    });
    expect(metadata.alternates).toMatchObject({
      canonical: `${baseUrl}/s/${studio.slug}`,
    });
  });
});

describe("buildStudioEventJsonLd", () => {
  const sessions = [
    {
      id: "session-1",
      classTypeName: "Vinyasa Flow",
      startsAt: "2026-08-03T09:00:00.000Z",
      endsAt: "2026-08-03T10:00:00.000Z",
    },
    {
      id: "session-2",
      classTypeName: "Restorative Yoga",
      startsAt: "2026-08-04T18:00:00.000Z",
      endsAt: "2026-08-04T19:00:00.000Z",
    },
  ];

  it("emits one schema.org Event per upcoming session", () => {
    const events = buildStudioEventJsonLd(studio, sessions, baseUrl);

    expect(events).toHaveLength(sessions.length);
    expect(events).toEqual(
      sessions.map((session) =>
        expect.objectContaining({
          "@type": "Event",
          name: session.classTypeName,
          startDate: session.startsAt,
          location: expect.objectContaining({
            "@type": "Place",
            name: studio.name,
          }),
        }),
      ),
    );
  });

  it("returns no events when there are no upcoming sessions", () => {
    expect(buildStudioEventJsonLd(studio, [], baseUrl)).toEqual([]);
  });
});

describe("public SEO routes", () => {
  it("composes the public studio URL", () => {
    expect(studioPageUrl(`${baseUrl}/`, studio.slug)).toBe(`${baseUrl}/s/${studio.slug}`);
  });

  it("builds sitemap entries for public studios", () => {
    expect(buildStudioSitemapEntries([studio], baseUrl)).toEqual([
      expect.objectContaining({
        url: `${baseUrl}/s/${studio.slug}`,
        lastModified: studio.createdAt,
      }),
    ]);
    expect(buildStudioSitemapEntries([], baseUrl)).toEqual([]);
  });

  it("allows crawling and points robots at the sitemap", () => {
    expect(buildRobotsMetadata(baseUrl)).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: `${baseUrl}/sitemap.xml`,
    });
  });
});
