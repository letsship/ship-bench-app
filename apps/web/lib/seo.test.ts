import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { absoluteUrl, getSiteUrl } from "./seo";

describe("seo helpers", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("falls back to localhost when unset", () => {
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("returns the env value when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiobook.example";
    expect(getSiteUrl()).toBe("https://studiobook.example");
  });

  it("joins paths without a double slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiobook.example/";
    expect(absoluteUrl("/s/riverbank")).toBe("https://studiobook.example/s/riverbank");
  });

  it("adds a leading slash when the path is missing one", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiobook.example";
    expect(absoluteUrl("s/riverbank")).toBe("https://studiobook.example/s/riverbank");
  });
});
