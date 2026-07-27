import { afterEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import PublicStudioPage, { generateMetadata } from "./page";

describe("public studio page", () => {
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("generates studio-specific metadata for a matching slug", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "riverbank" }) });

    expect(metadata.title).toBe("Riverbank Movement");
    expect(metadata.description).toContain("Riverbank Movement");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.alternates?.canonical).toContain("/s/riverbank");
  });

  it("calls notFound for an unknown slug", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));

    await expect(
      PublicStudioPage({ params: Promise.resolve({ slug: "does-not-exist" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
