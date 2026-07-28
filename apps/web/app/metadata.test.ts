import { describe, it, expect } from "vitest";
import { metadata as layoutMetadata, viewport } from "./layout";
import { metadata as pageMetadata } from "./page";

describe("metadata exports", () => {
  describe("layout metadata", () => {
    it("has a non-empty title", () => {
      expect(layoutMetadata.title).toBeTruthy();
    });

    it("has a non-empty description", () => {
      expect(layoutMetadata.description).toBeTruthy();
    });

    it("has a defined metadataBase", () => {
      expect(layoutMetadata.metadataBase).toBeDefined();
    });
  });

  describe("layout viewport", () => {
    it("has width device-width", () => {
      expect(viewport.width).toBe("device-width");
    });
  });

  describe("page metadata", () => {
    it("has a non-empty title", () => {
      expect(pageMetadata.title).toBeTruthy();
    });

    it("has a non-empty description", () => {
      expect(pageMetadata.description).toBeTruthy();
    });

    it("has canonical / in alternates", () => {
      expect(pageMetadata.alternates?.canonical).toBe("/");
    });
  });
});
