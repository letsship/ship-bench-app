import { describe, expect, it } from "vitest";
import type { PublicClass } from "@/lib/services/public-studio";
import type { Studio } from "@/lib/db/types";
import { buildEventsJsonLd, buildStudioMetadata } from "./studio-seo";

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "cs1",
    name: "Vinyasa Flow",
    instructor: "Noor",
    startsAt: "2026-07-15T08:00:00.000Z",
    endsAt: "2026-07-15T09:00:00.000Z",
  },
  {
    id: "cs2",
    name: "Reformer Pilates",
    instructor: "Sanne",
    startsAt: "2026-07-15T12:00:00.000Z",
    endsAt: "2026-07-15T13:00:00.000Z",
  },
];

describe("buildStudioMetadata", () => {
  it("uses the studio name as the title, never hardcoded 'Studio'", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.title).toBe("Riverbank Movement");
    expect(meta.title).not.toBe("Studio");
  });

  it("sets a description that names the studio", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.description).toContain("Riverbank Movement");
  });

  it("sets openGraph fields", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.openGraph?.title).toBe("Riverbank Movement");
    expect(meta.openGraph?.description).toContain("Riverbank Movement");
    expect(meta.openGraph?.type).toBe("website");
    expect(meta.openGraph?.url).toContain("/s/riverbank");
  });

  it("sets twitter card to summary_large_image", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.twitter?.title).toBe("Riverbank Movement");
  });

  it("sets a canonical URL", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.alternates?.canonical).toContain("/s/riverbank");
  });

  it("allows indexing", () => {
    const meta = buildStudioMetadata(studio, classes);
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("works with empty classes", () => {
    const meta = buildStudioMetadata(studio, []);
    expect(meta.title).toBe("Riverbank Movement");
    expect(meta.description).toContain("Riverbank Movement");
  });
});

describe("buildEventsJsonLd", () => {
  it("emits one Event per class", () => {
    const events = buildEventsJsonLd(studio, classes);
    expect(events).toHaveLength(2);
  });

  it("includes name, startDate, and location on each event", () => {
    const events = buildEventsJsonLd(studio, classes);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location.name).toBe("Riverbank Movement");
    }
  });

  it("includes the instructor as performer", () => {
    const events = buildEventsJsonLd(studio, classes);
    expect(events[0].performer.name).toBe("Noor");
    expect(events[1].performer.name).toBe("Sanne");
  });

  it("returns an empty array when no classes", () => {
    const events = buildEventsJsonLd(studio, []);
    expect(events).toEqual([]);
  });
});