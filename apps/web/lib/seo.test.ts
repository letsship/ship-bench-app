import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import { studioMetadata, buildStudioEventsJsonLd } from "@/lib/seo";

const mockStudio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "America/New_York",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("studioMetadata", () => {
  it("includes studio name in title", () => {
    const metadata = studioMetadata(mockStudio);
    expect(metadata.title).toContain("Riverbank Movement");
  });

  it("includes studio name in description", () => {
    const metadata = studioMetadata(mockStudio);
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("includes canonical URL with slug", () => {
    const metadata = studioMetadata(mockStudio);
    expect(metadata.alternates?.canonical).toBe("/s/riverbank");
  });

  it("includes OpenGraph tags", () => {
    const metadata = studioMetadata(mockStudio);
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("includes Twitter card tags", () => {
    const metadata = studioMetadata(mockStudio);
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toContain("Riverbank Movement");
  });
});

describe("buildStudioEventsJsonLd", () => {
  it("returns schema.org ItemList structure", () => {
    const classes = [
      {
        name: "Yoga Flow",
        startsAt: "2026-03-20T10:00:00.000Z",
      },
    ];
    const jsonLd = buildStudioEventsJsonLd(mockStudio, classes);
    expect(jsonLd).toHaveProperty("@context", "https://schema.org");
    expect(jsonLd).toHaveProperty("@type", "ItemList");
  });

  it("creates Event for each class with name, startDate, and location", () => {
    const classes = [
      {
        name: "Yoga Flow",
        startsAt: "2026-03-20T10:00:00.000Z",
      },
      {
        name: "Pilates Core",
        startsAt: "2026-03-21T14:00:00.000Z",
      },
    ];
    const jsonLd = buildStudioEventsJsonLd(mockStudio, classes) as Record<string, unknown>;
    const items = jsonLd.itemListElement as unknown[];
    expect(items).toHaveLength(2);

    items.forEach((item: unknown, index: number) => {
      const itemRecord = item as Record<string, unknown>;
      expect(itemRecord.position).toBe(index + 1);
      expect((itemRecord.item as Record<string, unknown>)["@type"]).toBe("Event");
      expect((itemRecord.item as Record<string, unknown>).name).toBe(classes[index].name);
      expect((itemRecord.item as Record<string, unknown>).startDate).toBe(classes[index].startsAt);
      expect(
        ((itemRecord.item as Record<string, unknown>).location as Record<string, unknown>).name,
      ).toBe(mockStudio.name);
    });
  });

  it("handles empty classes", () => {
    const classes: unknown[] = [];
    const jsonLd = buildStudioEventsJsonLd(
      mockStudio,
      classes as { name: string; startsAt: string }[],
    );
    const items = (jsonLd as Record<string, unknown>).itemListElement;
    expect(items).toHaveLength(0);
  });
});
