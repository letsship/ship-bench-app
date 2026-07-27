import { describe, it, expect } from "vitest";
import { homeMetadata, siteUrl } from "./seo";

describe("seo", () => {
  describe("siteUrl", () => {
    it("should be an absolute URL starting with http:// or https://", () => {
      expect(siteUrl).toMatch(/^https?:\/\//);
    });

    it("should not be empty", () => {
      expect(siteUrl).toBeTruthy();
    });
  });

  describe("homeMetadata", () => {
    it("should have a non-empty title", () => {
      expect(homeMetadata.title).toBeTruthy();
    });

    it("should have a non-empty description", () => {
      expect(homeMetadata.description).toBeTruthy();
    });

    it("should have metadataBase as a URL", () => {
      expect(homeMetadata.metadataBase).toBeInstanceOf(URL);
    });

    it("should have alternates.canonical set to /", () => {
      expect(homeMetadata.alternates?.canonical).toBe("/");
    });

    it("should have openGraph with title, description, and type", () => {
      expect(homeMetadata.openGraph?.title).toBeTruthy();
      expect(homeMetadata.openGraph?.description).toBeTruthy();
      expect(homeMetadata.openGraph?.type).toBe("website");
    });

    it("should have openGraph.url set to /", () => {
      expect(homeMetadata.openGraph?.url).toBe("/");
    });

    it("should have twitter with title and description", () => {
      expect(homeMetadata.twitter?.title).toBeTruthy();
      expect(homeMetadata.twitter?.description).toBeTruthy();
    });
  });
});
