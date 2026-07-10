import { afterEach, describe, expect, it, vi } from "vitest";

// env.ts caches its parsed result in module-scope variables, so each test
// resets the module registry and re-imports to get a fresh, uncached parse
// against that test's own process.env.
async function freshEnvModule() {
  vi.resetModules();
  return import("./env");
}

const validClientVars = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
};

const validServerVars = {
  ...validClientVars,
  SUPABASE_SECRET_KEY: "secret-key",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clientEnv", () => {
  it("accepts a valid URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validClientVars.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validClientVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const { clientEnv } = await freshEnvModule();
    expect(clientEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(validClientVars.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("rejects a non-URL string for NEXT_PUBLIC_SUPABASE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validClientVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const { clientEnv } = await freshEnvModule();
    expect(() => clientEnv()).toThrow();
  });

  it("rejects a non-URL string for NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validClientVars.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validClientVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url");
    const { clientEnv } = await freshEnvModule();
    expect(() => clientEnv()).toThrow();
  });
});

describe("serverEnv", () => {
  it("defaults SUPABASE_SCHEMA to public when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validServerVars.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validServerVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("SUPABASE_SECRET_KEY", validServerVars.SUPABASE_SECRET_KEY);
    vi.stubEnv("SUPABASE_SCHEMA", undefined);
    const { serverEnv } = await freshEnvModule();
    expect(serverEnv().SUPABASE_SCHEMA).toBe("public");
  });
});
