import { describe, expect, it } from "vitest";
import { homeMetadata, siteMetadata } from "./seo";

describe("seo metadata", () => {
  describe("siteMetadata", () => {
    it("has a non-empty default title", () => {
      expect(siteMetadata.title).toBeDefined();
      expect(typeof siteMetadata.title).toBe("object");
      if (typeof siteMetadata.title === "object" && "default" in siteMetadata.title) {
        expect(siteMetadata.title.default).toBeTruthy();
      }
    });

    it("has a non-empty description", () => {
      expect(siteMetadata.description).toBeTruthy();
    });

    it("has a valid absolute metadataBase URL", () => {
      expect(siteMetadata.metadataBase).toBeInstanceOf(URL);
      expect(siteMetadata.metadataBase?.href).toMatch(/^https?:\/\//);
    });

    it("marks the site as indexable (robots: index/follow)", () => {
      expect(siteMetadata.robots).toBeDefined();
      expect(siteMetadata.robots?.index).toBe(true);
      expect(siteMetadata.robots?.follow).toBe(true);
    });

    it("sets canonical to root /", () => {
      expect(siteMetadata.alternates?.canonical).toBe("/");
    });

    it("includes required openGraph fields", () => {
      expect(siteMetadata.openGraph).toBeDefined();
      expect(siteMetadata.openGraph?.type).toBe("website");
      expect(siteMetadata.openGraph?.title).toBeTruthy();
      expect(siteMetadata.openGraph?.description).toBeTruthy();
    });
  });

  describe("homeMetadata", () => {
    it("has a non-empty title", () => {
      expect(homeMetadata.title).toBeTruthy();
    });

    it("has a non-empty home-specific description", () => {
      expect(homeMetadata.description).toBeTruthy();
      expect(homeMetadata.description).not.toBe(siteMetadata.description);
    });

    it("sets canonical to root /", () => {
      expect(homeMetadata.alternates?.canonical).toBe("/");
    });

    it("marks the home page as indexable (robots: index/follow)", () => {
      expect(homeMetadata.robots).toBeDefined();
      expect(homeMetadata.robots?.index).toBe(true);
      expect(homeMetadata.robots?.follow).toBe(true);
    });

    it("includes page-scoped openGraph metadata", () => {
      expect(homeMetadata.openGraph).toBeDefined();
      expect(homeMetadata.openGraph?.type).toBe("website");
      expect(homeMetadata.openGraph?.url).toBe("/");
      expect(homeMetadata.openGraph?.siteName).toBe("Studiobook");
      expect(homeMetadata.openGraph?.title).toBeTruthy();
      expect(homeMetadata.openGraph?.description).toBeTruthy();
    });
  });
});
