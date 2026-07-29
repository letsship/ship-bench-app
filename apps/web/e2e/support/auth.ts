import type { APIRequestContext, Page } from "@playwright/test";

/** Where the `setup` project persists the authenticated operator's session. */
export const STORAGE_STATE = "e2e/.auth/operator.json";

/**
 * Sign in as the seeded studio operator through the fake magic-link stub. Only
 * valid under USE_FAKE_BACKENDS mode (seeded in-memory repositories + a fake auth
 * stub). The `setup` project runs this once and saves the session to
 * STORAGE_STATE; specs then inherit it and skip re-logging-in.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Re-seed the fake backend to a clean, known dataset via the test-only
 * `/api/__test__/reset` endpoint. Call in `beforeEach` so specs that mutate state
 * (bookings, scheduling) stay isolated and retry-safe. The session is a stateless
 * signed cookie, so resetting the data never signs the operator out.
 */
export async function resetBackend(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/test-reset");
  if (!response.ok()) throw new Error(`backend reset failed: HTTP ${response.status()}`);
}

/** Every authenticated page in the operator console. */
export const AUTHED_PATHS = [
  "/dashboard",
  "/classes",
  "/bookings",
  "/members",
  "/packages",
  "/invoices",
  "/reports",
  "/settings",
] as const;
