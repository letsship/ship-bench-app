import { describe, it, expect } from "vitest";
import { buildStudioMetadata, buildStudioJsonLd } from "./studio-seo";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

const testStudio: Studio = {
  id: "test-studio-id",
  name: "Test Studio",
  slug: "test-studio",
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00Z",
};

const testSession: PublicClass = {
  id: "session-1",
  name: "Morning Yoga",
  instructor: "Jane Doe",
  startsAt: "2026-08-01T09:00:00Z",
  endsAt: "2026-08-01T10:00:00Z",
};

const testUrl = "https://example.com/s/test-studio";

describe("buildStudioMetadata", () => {
  it("creates metadata with studio name", () => {
    const metadata = buildStudioMetadata({
      studio: testStudio,
      url: testUrl,
    });

    expect(metadata.title).toContain("Test Studio");
    expect(metadata.description).toContain("Test Studio");
  });

  it("sets index to true", () => {
    const metadata = buildStudioMetadata({
      studio: testStudio,
      url: testUrl,
    });

    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("includes openGraph tags", () => {
    const metadata = buildStudioMetadata({
      studio: testStudio,
      url: testUrl,
    });

    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.openGraph?.url).toBe(testUrl);
    expect(metadata.openGraph?.title).toContain("Test Studio");
  });

  it("includes twitter tags", () => {
    const metadata = buildStudioMetadata({
      studio: testStudio,
      url: testUrl,
    });

    expect(metadata.twitter?.card).toBe("summary_large_image");
    expect(metadata.twitter?.title).toContain("Test Studio");
  });

  it("includes canonical URL", () => {
    const metadata = buildStudioMetadata({
      studio: testStudio,
      url: testUrl,
    });

    expect(metadata.alternates?.canonical).toBe(testUrl);
  });
});

describe("buildStudioJsonLd", () => {
  it("creates one event per session", () => {
    const events = buildStudioJsonLd({
      studio: testStudio,
      sessions: [testSession],
      url: testUrl,
    });

    expect(events).toHaveLength(1);
  });

  it("includes name, startDate, and location in each event", () => {
    const events = buildStudioJsonLd({
      studio: testStudio,
      sessions: [testSession],
      url: testUrl,
    });

    const event = events[0];
    expect(event.name).toBe("Morning Yoga");
    expect(event.startDate).toBe("2026-08-01T09:00:00Z");
    expect(event.location.name).toBe("Test Studio");
  });

  it("uses schema.org Event type", () => {
    const events = buildStudioJsonLd({
      studio: testStudio,
      sessions: [testSession],
      url: testUrl,
    });

    const event = events[0];
    expect(event["@type"]).toBe("Event");
    expect(event["@context"]).toBe("https://schema.org");
  });

  it("handles multiple sessions", () => {
    const session2: PublicClass = {
      id: "session-2",
      name: "Evening Yoga",
      instructor: "John Smith",
      startsAt: "2026-08-01T18:00:00Z",
      endsAt: "2026-08-01T19:00:00Z",
    };

    const events = buildStudioJsonLd({
      studio: testStudio,
      sessions: [testSession, session2],
      url: testUrl,
    });

    expect(events).toHaveLength(2);
    expect(events[0].name).toBe("Morning Yoga");
    expect(events[1].name).toBe("Evening Yoga");
  });
});
