import { describe, expect, it } from "vitest";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { buildEventJsonLd, buildStudioMetadata } from "./studio-seo";

const studio: Studio = {
  id: "studio-1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const classes: PublicClass[] = [
  {
    id: "class-1",
    name: "Vinyasa Flow",
    instructor: "Noor",
    startsAt: "2026-08-02T09:00:00.000Z",
    endsAt: "2026-08-02T10:00:00.000Z",
  },
  {
    id: "class-2",
    name: "Reformer Pilates",
    instructor: "Priya",
    startsAt: "2026-08-03T17:00:00.000Z",
    endsAt: "2026-08-03T18:00:00.000Z",
  },
];

describe("studio SEO builders", () => {
  it("builds studio-specific metadata", () => {
    const metadata = buildStudioMetadata(studio, classes, "https://example.com");
    const title = String(metadata.title);
    const description = String(metadata.description);

    expect(title).toContain(studio.name);
    expect(description).toContain(studio.name);
    expect(title).not.toBe("Studio");
    expect(metadata.openGraph).toMatchObject({ title, description, type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title, description });
    expect(metadata.alternates?.canonical).toBe("https://example.com/s/riverbank");
  });

  it("builds one Event per upcoming class", () => {
    const events = buildEventJsonLd(studio, classes);

    expect(events).toHaveLength(classes.length);
    expect(events).toEqual(
      expect.arrayContaining(
        classes.map((classItem) =>
          expect.objectContaining({
            "@type": "Event",
            name: classItem.name,
            startDate: classItem.startsAt,
            location: expect.objectContaining({ name: studio.name }),
          }),
        ),
      ),
    );
    expect(buildEventJsonLd(studio, [])).toEqual([]);
  });
});
