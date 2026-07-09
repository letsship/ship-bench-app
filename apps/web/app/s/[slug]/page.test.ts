import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { generateMetadata } from "./page";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("public studio page metadata", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("names the studio in the title, description, OG, Twitter, and canonical tags for a known slug", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });

    expect(metadata.title).toBe("Riverbank Movement — Class Schedule & Booking");
    expect(metadata.description).toContain("Riverbank Movement");
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/s/riverbank");
    expect(metadata.openGraph).toMatchObject({
      title: "Riverbank Movement — Class Schedule & Booking",
      type: "website",
      url: "http://localhost:3000/s/riverbank",
    });
    expect(metadata.openGraph?.description).toContain("Riverbank Movement");
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "Riverbank Movement — Class Schedule & Booking",
    });
  });

  it("falls back to a not-found title for an unknown slug, without naming a studio", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(metadata.title).toBe("Studio not found");
    expect(metadata.openGraph).toBeUndefined();
  });
});
