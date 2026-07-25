import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";
import { generateMetadata } from "./page";

describe("Public Studio Page", () => {
  beforeEach(() => {
    const seed = buildSeed();
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  it("generateMetadata returns studio-specific metadata with index:true", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "riverbank" }),
    });

    expect(metadata.title).toContain("Riverbank Movement");
    expect(metadata.description).toContain("Riverbank Movement");
    expect(metadata.robots?.index).toBe(true);
    expect(metadata.robots?.follow).toBe(true);
    expect(metadata.openGraph?.title).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
  });

  it("generateMetadata returns default metadata when studio not found", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "unknown" }),
    });

    expect(metadata.title).toBe("Not Found");
  });
});
