import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import {
  buildStudioEventsJsonLd,
  buildStudioMetadata,
  studioDescription,
  studioUrl,
} from "@/lib/seo";
import type { PublicClass } from "@/lib/services/public-studio";

const NOW = new Date("2026-03-15T12:00:00.000Z");

const studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2025-09-01T09:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "c1",
    name: "Vinyasa Flow",
    instructor: "Noor",
    startsAt: "2026-03-15T17:00:00.000Z",
    endsAt: "2026-03-15T18:00:00.000Z",
  },
  {
    id: "c2",
    name: "Reformer Pilates",
    instructor: "Tomás",
    startsAt: "2026-03-16T08:00:00.000Z",
    endsAt: "2026-03-16T09:00:00.000Z",
  },
];

describe("lib/seo", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  describe("buildStudioMetadata", () => {
    it("names the studio in the title and description (not a hardcoded 'Studio')", () => {
      const meta = buildStudioMetadata({ studio });
      expect(meta.title).toContain("Riverbank Movement");
      expect(meta.title).not.toBe("Studio");
      const desc = meta.description;
      expect(desc).toContain("Riverbank Movement");
    });

    it("emits Open Graph title/description/type", () => {
      const meta = buildStudioMetadata({ studio });
      expect(meta.openGraph?.title).toContain("Riverbank Movement");
      expect(meta.openGraph?.description).toContain("Riverbank Movement");
      expect(meta.openGraph?.type).toBe("website");
    });

    it("emits Twitter card tags", () => {
      const meta = buildStudioMetadata({ studio });
      expect(meta.twitter?.card).toBe("summary_large_image");
      expect(meta.twitter?.title).toContain("Riverbank Movement");
      expect(meta.twitter?.description).toContain("Riverbank Movement");
    });

    it("sets an absolute canonical URL ending in /s/<slug>", () => {
      const meta = buildStudioMetadata({ studio });
      const canonical = meta.alternates?.canonical;
      expect(canonical).toBe(studioUrl("riverbank"));
      expect(canonical).toMatch(/^https?:\/\//);
      expect(canonical).toMatch(/\/s\/riverbank$/);
    });

    it("never sets a noindex robots directive", () => {
      const meta = buildStudioMetadata({ studio });
      expect(meta.robots).toBeUndefined();
    });
  });

  describe("studioDescription", () => {
    it("is studio-specific", () => {
      expect(studioDescription(studio)).toContain("Riverbank Movement");
    });
  });

  describe("buildStudioEventsJsonLd", () => {
    it("returns one Event per upcoming class", () => {
      const events = buildStudioEventsJsonLd({ studio, classes });
      expect(events).toHaveLength(2);
    });

    it("each event has name, startDate, and location", () => {
      const events = buildStudioEventsJsonLd({ studio, classes });
      for (const event of events) {
        expect(event["@type"]).toBe("Event");
        expect(typeof event.name).toBe("string");
        expect(typeof event.startDate).toBe("string");
        expect(event.location["@type"]).toBe("Place");
        expect(event.location.name).toBe("Riverbank Movement");
      }
    });

    it("includes the instructor as a performer", () => {
      const events = buildStudioEventsJsonLd({ studio, classes });
      expect(events[0].performer?.name).toBe("Noor");
    });

    it("returns an empty array when there are no upcoming classes", () => {
      expect(buildStudioEventsJsonLd({ studio, classes: [] })).toEqual([]);
    });
  });
});
