import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { default as PublicStudioPage, generateMetadata } from "./page";

// buildSeed() is anchored to the real clock (sessions run a week either side
// of `now`), and resolvePublicStudio() filters "upcoming" against the real
// `new Date()` too — so the seed must be built from the real clock here.
const NOW = new Date();

describe("public studio page", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns studio-specific metadata naming the studio, not a hardcoded placeholder", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.twitter?.card).toBe("summary");
  });

  it("returns non-indexable metadata for an unknown slug", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "no-such-studio" }),
    });
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("calls notFound (404) for a slug that matches no studio", async () => {
    await expect(
      PublicStudioPage({ params: Promise.resolve({ slug: "no-such-studio" }) }),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("renders the studio name, upcoming classes, and a descriptive CTA for a known slug", async () => {
    const element = await PublicStudioPage({ params: Promise.resolve({ slug: "riverbank" }) });
    const rendered = JSON.stringify(element);
    expect(rendered).toContain("Riverbank Movement");
    expect(rendered).toContain("studio cover photo");
    expect(rendered).not.toContain("Click here");
    expect(rendered).toContain("Sign in to book a class");
  });

  it("embeds one schema.org Event per upcoming class as JSON-LD", async () => {
    const element = await PublicStudioPage({ params: Promise.resolve({ slug: "riverbank" }) });
    const children = (element as unknown as { props: { children: unknown[] } }).props.children;
    const script = children[0] as {
      type: string;
      props: { type: string; dangerouslySetInnerHTML: { __html: string } };
    };
    expect(script.type).toBe("script");
    expect(script.props.type).toBe("application/ld+json");
    const events = JSON.parse(script.props.dangerouslySetInnerHTML.__html);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location).toBeTruthy();
    }
  });
});
