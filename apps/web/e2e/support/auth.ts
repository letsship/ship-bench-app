import type { Page } from "@playwright/test";

/**
 * Sign in as the seeded studio operator through the fake magic-link stub.
 * Only valid under USE_FAKE_BACKENDS mode (seeded in-memory repositories + a
 * fake auth stub), which is how the whole e2e suite runs — no real auth
 * provider, Supabase, or Resend account is involved.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

/** Every authenticated page in the operator console. */
export const AUTHED_PATHS = [
  "/dashboard",
  "/classes",
  "/bookings",
  "/members",
  "/invoices",
  "/reports",
  "/settings",
] as const;
