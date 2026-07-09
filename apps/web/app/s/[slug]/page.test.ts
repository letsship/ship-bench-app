import { afterEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { generateMetadata } from "./page";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("generateMetadata", () => {
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  it("describes the studio with OG, Twitter, and canonical URL metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });

    expect(metadata.title).toBe("Riverbank Movement — Classes & schedule");
    expect(metadata.description).toBe("See upcoming classes at Riverbank Movement and sign up.");
    expect(metadata.alternates).toMatchObject({
      canonical: "https://studiobook.example.com/s/riverbank",
    });
    expect(metadata.openGraph).toMatchObject({
      title: "Riverbank Movement — Classes & schedule",
      description: "See upcoming classes at Riverbank Movement and sign up.",
      type: "website",
      url: "https://studiobook.example.com/s/riverbank",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Riverbank Movement — Classes & schedule",
      description: "See upcoming classes at Riverbank Movement and sign up.",
    });
  });

  it("returns empty metadata for an unknown slug", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(metadata).toEqual({});
  });
});
