import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import PublicStudioPage, { generateMetadata } from "@/app/s/[slug]/page";

// Anchored to the seed clock so the seeded sessions land in the future and the
// page's "upcoming classes" list is non-empty. resolvePublicStudio filters with
// `new Date().toISOString()`, so we freeze the real clock to the seed NOW.
const NOW = new Date("2026-03-15T12:00:00.000Z");
const SEED_SLUG = "riverbank";

describe("public studio page /s/[slug]", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.useRealTimers();
  });

  describe("generateMetadata", () => {
    it("returns studio-named title and description for a known slug", async () => {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: SEED_SLUG }) });
      expect(meta.title).toContain("Riverbank Movement");
      expect(meta.description).toContain("Riverbank Movement");
    });

    it("emits Open Graph and Twitter tags and a canonical URL", async () => {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: SEED_SLUG }) });
      expect(meta.openGraph?.title).toContain("Riverbank Movement");
      expect(meta.openGraph?.type).toBe("website");
      expect(meta.twitter?.card).toBe("summary_large_image");
      const canonical = meta.alternates?.canonical;
      expect(canonical).toMatch(/\/s\/riverbank$/);
    });

    it("emits no noindex robots directive", async () => {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: SEED_SLUG }) });
      expect(meta.robots).toBeUndefined();
    });
  });

  describe("default page component", () => {
    it("renders the studio name and upcoming classes (name, time, instructor)", async () => {
      const html = renderToString(
        await PublicStudioPage({ params: Promise.resolve({ slug: SEED_SLUG }) }),
      );
      expect(html).toContain("Riverbank Movement");
      // At least one seeded class type name appears.
      expect(html).toMatch(/Vinyasa Flow|Yin &amp; Restore|Reformer Pilates|Wheel Throwing|Hand Building/);
      // "with <instructor>" appears for upcoming classes (React inserts an
      // HTML comment between the literal and the expression).
      expect(html).toMatch(/with .*?(Noor|Sanne|Tomás|Priya|Wouter)/);
    });

    it("embeds schema.org Event JSON-LD", async () => {
      const html = renderToString(
        await PublicStudioPage({ params: Promise.resolve({ slug: SEED_SLUG }) }),
      );
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain('"@type":"Event"');
    });

    it("uses a descriptive image alt derived from the studio name", async () => {
      const html = renderToString(
        await PublicStudioPage({ params: Promise.resolve({ slug: SEED_SLUG }) }),
      );
      expect(html).toContain("Riverbank Movement studio cover image");
    });

    it("uses a descriptive call-to-action (not 'Click here')", async () => {
      const html = renderToString(
        await PublicStudioPage({ params: Promise.resolve({ slug: SEED_SLUG }) }),
      );
      expect(html).not.toContain("Click here");
      expect(html).toContain("Book a class at");
      expect(html).toContain("Riverbank Movement");
    });

    it("returns 404 (notFound) for an unknown slug", async () => {
      await expect(
        PublicStudioPage({ params: Promise.resolve({ slug: "does-not-exist" }) }),
      ).rejects.toThrow();
    });
  });
});
