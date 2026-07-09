import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { buildStudioEventJsonLd, buildStudioMetadata } from "./studio-metadata";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const canonicalUrl = "http://localhost:3000/s/riverbank";

const classes: PublicClass[] = [
  {
    id: "cs1",
    name: "Vinyasa Flow",
    instructor: "Amara Okafor",
    startsAt: "2026-03-20T09:00:00.000Z",
    endsAt: "2026-03-20T10:00:00.000Z",
  },
  {
    id: "cs2",
    name: "Reformer Pilates",
    instructor: "Bram de Vries",
    startsAt: "2026-03-21T09:00:00.000Z",
    endsAt: "2026-03-21T10:00:00.000Z",
  },
];

describe("buildStudioMetadata", () => {
  it("embeds the real studio name in title and description, not a hardcoded label", () => {
    const metadata = buildStudioMetadata(studio, canonicalUrl);
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("sets studio-specific Open Graph fields", () => {
    const metadata = buildStudioMetadata(studio, canonicalUrl);
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.openGraph?.url).toBe(canonicalUrl);
  });

  it("sets Twitter card fields", () => {
    const metadata = buildStudioMetadata(studio, canonicalUrl);
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toContain("Riverbank Movement");
  });

  it("sets the canonical URL to the studio's public page", () => {
    const metadata = buildStudioMetadata(studio, canonicalUrl);
    expect(metadata.alternates?.canonical).toBe(canonicalUrl);
  });

  it("does not leak the noindex directive", () => {
    const metadata = buildStudioMetadata(studio, canonicalUrl);
    expect(metadata.robots).toBeUndefined();
  });
});

describe("buildStudioEventJsonLd", () => {
  it("returns one schema.org Event per upcoming class with name, startDate, and location", () => {
    const jsonLd = buildStudioEventJsonLd(studio, classes, canonicalUrl);
    expect(jsonLd).toHaveLength(2);
    for (const [index, event] of jsonLd.entries()) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBe(classes[index].name);
      expect(event.startDate).toBe(classes[index].startsAt);
      expect(event.location).toMatchObject({ "@type": "Place", name: studio.name });
    }
  });

  it("returns an empty array (not malformed data) when there are no upcoming classes", () => {
    expect(buildStudioEventJsonLd(studio, [], canonicalUrl)).toEqual([]);
  });
});
