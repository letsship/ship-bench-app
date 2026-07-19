import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { buildEventsJsonLd, buildStudioMetadata, resolvePublicStudio } from "./public-studio";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("public studio service", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("resolvePublicStudio returns the studio and its upcoming classes", async () => {
    const result = await resolvePublicStudio("riverbank", NOW);
    expect(result).not.toBeNull();
    expect(result?.studio.name).toBeDefined();
    expect(result?.studio.slug).toBe("riverbank");
    expect(Array.isArray(result?.classes)).toBe(true);
    expect(result!.classes.length).toBeGreaterThan(0);
  });

  it("resolvePublicStudio returns null for an unknown slug", async () => {
    const result = await resolvePublicStudio("nonexistent", NOW);
    expect(result).toBeNull();
  });

  it("resolvePublicStudio classes include name, instructor, and startsAt", async () => {
    const result = await resolvePublicStudio("riverbank", NOW);
    const cls = result!.classes[0];
    expect(cls).toHaveProperty("name");
    expect(cls).toHaveProperty("instructor");
    expect(cls).toHaveProperty("startsAt");
    expect(typeof cls.name).toBe("string");
    expect(typeof cls.instructor).toBe("string");
    expect(typeof cls.startsAt).toBe("string");
  });

  it("buildStudioMetadata returns a studio-specific title and description", async () => {
    const result = await resolvePublicStudio("riverbank");
    const studio = result!.studio;
    const metadata = buildStudioMetadata(studio);

    expect(metadata.title).toContain(studio.name);
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain(studio.name);
  });

  it("buildStudioMetadata includes Open Graph tags", () => {
    const studio = {
      id: "1",
      name: "Test Studio",
      slug: "test",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };
    const metadata = buildStudioMetadata(studio);

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBeDefined();
    expect(metadata.openGraph?.description).toBeDefined();
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("buildStudioMetadata includes Twitter card tags", () => {
    const studio = {
      id: "1",
      name: "Test Studio",
      slug: "test",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };
    const metadata = buildStudioMetadata(studio);

    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });

  it("buildStudioMetadata includes a canonical URL", () => {
    const studio = {
      id: "1",
      name: "Test Studio",
      slug: "test",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    };
    const metadata = buildStudioMetadata(studio, "http://example.com");

    expect(metadata.alternates?.canonical).toBe("http://example.com/s/test");
  });

  it("buildEventsJsonLd returns one Event per class", async () => {
    const result = await resolvePublicStudio("riverbank", NOW);
    const events = buildEventsJsonLd(result!.studio, result!.classes);

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(result!.classes.length);
  });

  it("buildEventsJsonLd events have required fields", async () => {
    const result = await resolvePublicStudio("riverbank", NOW);
    const events = buildEventsJsonLd(result!.studio, result!.classes);

    events.forEach((event) => {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeDefined();
      expect(event.startDate).toBeDefined();
      expect(event.location.name).toBe(result!.studio.name);
    });
  });
});
