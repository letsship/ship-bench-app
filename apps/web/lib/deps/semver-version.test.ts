import { createRequire } from "node:module";

import { satisfies } from "semver";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const require = createRequire(import.meta.url);
const packageSchema = z.object({ version: z.string() });

describe("semver dependency", () => {
  it("resolves a version patched for CVE-2022-25883", () => {
    const { version } = packageSchema.parse(require("semver/package.json"));

    expect(satisfies(version, ">=7.5.2")).toBe(true);
  });
});
