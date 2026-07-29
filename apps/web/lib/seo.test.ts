import { describe, expect, it } from "vitest";
import { buildStudioEventJsonLd, buildStudioMetadata } from "@/lib/seo";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const sessions: PublicClass[] = [
  {
    id: "cs1",
    name: "Vinyasa Flow",
    instructor: "Noor",
    startsAt: "2026-07-08T08:00:00.000Z",
    endsAt: "2026-07-08T09:00:00.000Z",
  },
  {
    id: "cs2",
    name: "Yin & Restore",
    instructor: "Sanne",
    startsAt: "2026-07-08T12:00:00.000Z",
    endsAt: "2026-07-08T13:00:00.000Z",
  },
];

const siteUrl = "http://localhost:3000";

describe("buildStudioMetadata", () => {
  it("includes the studio name in the title (not a hardcoded 'Studio')", () => {
    const meta = buildStudioMetadata(studio, { slug: studio.slug, sessions, siteUrl });
    expect(meta.title).toBe("Riverbank Movement");
  });

  it("includes the studio name in the description", () => {
    const meta = buildStudioMetadata(studio, { slug: studio.slug, sessions, siteUrl });
    expect(meta.description).toContain("Riverbank Movement");
  });

  it("sets Open Graph tags", () => {
    const meta = buildStudioMetadata(studio, { slug: studio.slug, sessions, siteUrl });
    expect(meta.openGraph?.title).toBe("Riverbank Movement");
    expect(meta.openGraph?.description).toContain("Riverbank Movement");
    expect(meta.openGraph?.type).toBe("website");
    expect(meta.openGraph?.url).toBe("http://localhost:3000/s/riverbank");
  });

  it("sets Twitter card tags", () => {
    const meta = buildStudioMetadata(studio, { slug: studio.slug, sessions, siteUrl });
    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.twitter?.title).toBe("Riverbank Movement");
    expect(meta.twitter?.description).toContain("Riverbank Movement");
  });

  it("sets the canonical URL to /s/<slug>", () => {
    const meta = buildStudioMetadata(studio, { slug: studio.slug, sessions, siteUrl });
    expect(meta.alternates?.canonical).toBe("http://localhost:3000/s/riverbank");
  });
});

describe("buildStudioEventJsonLd", () => {
  it("emits one Event per upcoming class", () => {
    const events = buildStudioEventJsonLd(studio, sessions, { siteUrl });
    expect(events).toHaveLength(2);
  });

  it("each event has a name, startDate, and location", () => {
    const events = buildStudioEventJsonLd(studio, sessions, { siteUrl });
    for (const event of events) {
      expect(event).toMatchObject({
        "@type": "Event",
        name: expect.any(String),
        startDate: expect.any(String),
        location: {
          "@type": "Place",
          name: studio.name,
        },
      });
    }
  });

  it("assigns the correct class name as the event name", () => {
    const events = buildStudioEventJsonLd(studio, sessions, { siteUrl });
    expect(events[0].name).toBe("Vinyasa Flow");
    expect(events[1].name).toBe("Yin & Restore");
  });

  it("assigns the correct startDate per session", () => {
    const events = buildStudioEventJsonLd(studio, sessions, { siteUrl });
    expect(events[0].startDate).toBe("2026-07-08T08:00:00.000Z");
    expect(events[1].startDate).toBe("2026-07-08T12:00:00.000Z");
  });

  it("each event has an endDate", () => {
    const events = buildStudioEventJsonLd(studio, sessions, { siteUrl });
    for (const event of events) {
      expect(event.endDate).toBeDefined();
    }
  });
});