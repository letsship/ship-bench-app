import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { generateMetadata } from "./page";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("generateMetadata for the public studio page", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("names the studio and enables indexing for a known slug", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });

    expect(metadata.title).toBe("Riverbank Movement — book a class");
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain("Riverbank Movement");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
    expect(metadata.openGraph).toMatchObject({
      title: "Riverbank Movement — book a class",
      type: "website",
    });
    expect(metadata.openGraph?.images).toBeTruthy();
    expect(metadata.twitter).toMatchObject({ card: "summary" });
    expect(
      metadata.twitter && "images" in metadata.twitter && metadata.twitter.images,
    ).toBeTruthy();
  });

  it("leaves an unknown slug unindexed", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "does-not-exist" }),
    });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
