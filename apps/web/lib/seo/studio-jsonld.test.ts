import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { buildStudioEventsJsonLd } from "./studio-jsonld";

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
    instructor: "Noor",
    startsAt: "2026-07-11T08:00:00.000Z",
    endsAt: "2026-07-11T09:00:00.000Z",
  },
  {
    id: "c2",
    name: "Reformer Pilates",
    instructor: "Priya",
    startsAt: "2026-07-11T12:00:00.000Z",
    endsAt: "2026-07-11T13:00:00.000Z",
  },
];

describe("buildStudioEventsJsonLd", () => {
  it("returns one schema.org Event per upcoming class", () => {
    const events = buildStudioEventsJsonLd(studio, classes, "https://example.com/s/riverbank");
    expect(events).toHaveLength(2);
  });

  it("populates the required name/startDate/location fields from the class + studio", () => {
    const [event] = buildStudioEventsJsonLd(studio, classes, "https://example.com/s/riverbank");
    expect(event["@type"]).toBe("Event");
    expect(event.name).toBe("Vinyasa Flow");
    expect(event.startDate).toBe("2026-07-11T08:00:00.000Z");
    expect(event.endDate).toBe("2026-07-11T09:00:00.000Z");
    expect(event.location).toEqual({ "@type": "Place", name: "Riverbank Movement" });
    expect(event.performer).toEqual({ "@type": "Person", name: "Noor" });
    expect(event.organizer).toEqual({
      "@type": "Organization",
      name: "Riverbank Movement",
      url: "https://example.com/s/riverbank",
    });
  });

  it("returns an empty array when there are no upcoming classes", () => {
    expect(buildStudioEventsJsonLd(studio, [], "https://example.com/s/riverbank")).toEqual([]);
  });
});
