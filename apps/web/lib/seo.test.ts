import { afterEach, describe, expect, it } from "vitest";
import { buildPageMetadata, getSiteUrl } from "./seo";

describe("buildPageMetadata", () => {
  it("derives openGraph title and description from the inputs", () => {
    const metadata = buildPageMetadata({
      title: "Studiobook — studio class booking",
      description: "Bookings, members, and invoicing for movement studios.",
    });

    expect(metadata.openGraph?.title).toBe("Studiobook — studio class booking");
    expect(metadata.openGraph?.description).toBe(
      "Bookings, members, and invoicing for movement studios.",
    );
  });

  it("defaults og:type to website", () => {
    const metadata = buildPageMetadata({ title: "Sign in", description: "Access your studio." });

    expect(metadata.openGraph?.type).toBe("website");
  });

  it("allows overriding og:type", () => {
    const metadata = buildPageMetadata({
      title: "Sign in",
      description: "Access your studio.",
      type: "profile",
    });

    expect(metadata.openGraph?.type).toBe("profile");
  });

  it("sets a summary twitter card derived from the same title and description", () => {
    const metadata = buildPageMetadata({ title: "Sign in", description: "Access your studio." });

    expect(metadata.twitter?.card).toBe("summary");
    expect(metadata.twitter?.title).toBe("Sign in");
    expect(metadata.twitter?.description).toBe("Access your studio.");
  });
});

describe("getSiteUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("reflects the env var when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiobook.example.com";

    expect(getSiteUrl()).toBe("https://studiobook.example.com");
  });
});
