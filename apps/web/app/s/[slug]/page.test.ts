import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { generateMetadata } from "./page";

const NOW = new Date();

describe("public studio page", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });

  describe("generateMetadata", () => {
    it("generates metadata with studio name in title for valid slug", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
      expect(metadata.title).toContain("Riverbank Movement");
    });

    it("generates metadata with studio name in description for valid slug", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
      expect(metadata.description).toContain("Riverbank Movement");
    });

    it("generates canonical URL for valid slug", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
      expect(metadata.alternates?.canonical).toContain("riverbank");
    });

    it("includes OpenGraph metadata", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
      expect(metadata.openGraph?.title).toBeTruthy();
      expect(metadata.openGraph?.description).toBeTruthy();
      expect(metadata.openGraph?.type).toBe("website");
    });

    it("includes Twitter card metadata", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
      expect(metadata.twitter?.card).toBe("summary_large_image");
      expect(metadata.twitter?.title).toBeTruthy();
      expect(metadata.twitter?.description).toBeTruthy();
    });

    it("enables indexing via robots metadata", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });
      expect(metadata.robots?.index).toBe(true);
      expect(metadata.robots?.follow).toBe(true);
    });

    it("returns fallback metadata for unknown slug", async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: "nonexistent" }) });
      expect(metadata.title).toBeTruthy();
    });
  });
});
