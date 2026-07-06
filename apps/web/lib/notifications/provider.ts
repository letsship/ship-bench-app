import { createCloudflareProvider } from "./cloudflare-provider";
import { createFakeProvider } from "./fake-provider";
import type { NotificationProvider } from "./types";

// The app's notification provider. Production uses Cloudflare Email (a real
// API token is required — a missing token is surfaced as an error, never
// silently degraded). The local fake-backends mode uses the in-memory
// recorder so the app runs with no vendor account.
export function createNotificationProvider(): NotificationProvider {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeProvider();
  }
  const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_EMAIL_API_TOKEN is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  // The send API is scoped to an account id embedded in the endpoint path
  // (see cloudflare-provider.ts), so it's required alongside the token.
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createCloudflareProvider({
    apiToken,
    accountId,
    from: process.env.STUDIOBOOK_FROM_EMAIL ?? "Studiobook <hello@riverbank.studio>",
  });
}
