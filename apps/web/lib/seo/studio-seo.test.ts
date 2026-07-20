import { describe, expect, it } from "vitest";
import {
  buildStudioEventsJsonLd,
  buildStudioMetadata,
  canonicalStudioUrl,
  siteBaseUrl,
} from "./studio-seo";

describe("siteBaseUrl", () => {
  it("returns localhost fallback when NEXT_PUBLIC_SITE_URL is not set", () => {
    expect(siteBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("canonicalStudioUrl", () => {
  it("builds canonical URL from studio slug", () => {
    const url = canonicalStudioUrl("riverbank");
    expect(url).toContain("/s/riverbank");
  });

  it("uses siteBaseUrl as prefix", () => {
    const url = canonicalStudioUrl("test-studio");
    expect(url).toContain(siteBaseUrl());
  });
});

describe("buildStudioMetadata", () => {
  const studio = {
    id: "studio-1",
    name: "Riverbank Movement",
    slug: "riverbank",
    timezone: "America/New_York",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("includes studio name in title, not generic 'Studio'", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 5 });
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toEqual("Studio");
  });

  it("includes studio name in description", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 3 });
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("mentions upcoming classes when sessions exist", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 2 });
    expect(metadata.description).toContain("Upcoming classes");
  });

  it("describes studio when no sessions", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 0 });
    expect(metadata.description).toContain("Riverbank Movement");
  });

  it("enables indexing", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 1 });
    expect(metadata.robots?.index).toBe(true);
  });

  it("includes Open Graph tags with studio name", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 1 });
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
  });

  it("includes Twitter card with studio name", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 1 });
    expect(metadata.twitter?.title).toContain("Riverbank Movement");
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });

  it("includes canonical URL", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 1 });
    expect(metadata.alternates?.canonical).toContain(`/s/${studio.slug}`);
  });

  it("includes Open Graph URL", () => {
    const metadata = buildStudioMetadata({ studio, sessionCount: 1 });
    expect(metadata.openGraph?.url).toContain(`/s/${studio.slug}`);
  });
});

describe("buildStudioEventsJsonLd", () => {
  const studio = {
    id: "studio-1",
    name: "Riverbank Movement",
    slug: "riverbank",
    timezone: "America/New_York",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("returns empty array when no sessions", () => {
    const events = buildStudioEventsJsonLd({ studio, sessions: [] });
    expect(events).toEqual([]);
  });

  it("emits one Event per session", () => {
    const sessions = [
      {
        id: "session-1",
        name: "Vinyasa Flow",
        instructor: "Noor",
        startsAt: "2026-03-14T09:00:00Z",
        endsAt: "2026-03-14T10:00:00Z",
      },
      {
        id: "session-2",
        name: "Hatha Yoga",
        instructor: "Alex",
        startsAt: "2026-03-14T10:30:00Z",
        endsAt: "2026-03-14T11:30:00Z",
      },
    ];
    const events = buildStudioEventsJsonLd({ studio, sessions });
    expect(events).toHaveLength(2);
  });

  it("each Event has @context and @type", () => {
    const sessions = [
      {
        id: "session-1",
        name: "Vinyasa Flow",
        instructor: "Noor",
        startsAt: "2026-03-14T09:00:00Z",
        endsAt: "2026-03-14T10:00:00Z",
      },
    ];
    const events = buildStudioEventsJsonLd({ studio, sessions });
    expect(events[0]["@context"]).toBe("https://schema.org");
    expect(events[0]["@type"]).toBe("Event");
  });

  it("each Event includes name from session", () => {
    const sessions = [
      {
        id: "session-1",
        name: "Vinyasa Flow",
        instructor: "Noor",
        startsAt: "2026-03-14T09:00:00Z",
        endsAt: "2026-03-14T10:00:00Z",
      },
    ];
    const events = buildStudioEventsJsonLd({ studio, sessions });
    expect(events[0].name).toBe("Vinyasa Flow");
  });

  it("each Event includes startDate from session", () => {
    const sessions = [
      {
        id: "session-1",
        name: "Vinyasa Flow",
        instructor: "Noor",
        startsAt: "2026-03-14T09:00:00Z",
        endsAt: "2026-03-14T10:00:00Z",
      },
    ];
    const events = buildStudioEventsJsonLd({ studio, sessions });
    expect(events[0].startDate).toBe("2026-03-14T09:00:00Z");
  });

  it("each Event includes endDate from session", () => {
    const sessions = [
      {
        id: "session-1",
        name: "Vinyasa Flow",
        instructor: "Noor",
        startsAt: "2026-03-14T09:00:00Z",
        endsAt: "2026-03-14T10:00:00Z",
      },
    ];
    const events = buildStudioEventsJsonLd({ studio, sessions });
    expect(events[0].endDate).toBe("2026-03-14T10:00:00Z");
  });

  it("each Event includes location with studio name", () => {
    const sessions = [
      {
        id: "session-1",
        name: "Vinyasa Flow",
        instructor: "Noor",
        startsAt: "2026-03-14T09:00:00Z",
        endsAt: "2026-03-14T10:00:00Z",
      },
    ];
    const events = buildStudioEventsJsonLd({ studio, sessions });
    expect(events[0].location["@type"]).toBe("Place");
    expect(events[0].location.name).toBe("Riverbank Movement");
  });
});
