import { createFakeProvider } from "./fake-provider";
import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
import type { NotificationProvider } from "./types";

// The app's notification provider. Production uses Cloudflare Email (a real API
// token is required — a missing token is surfaced as an error, never silently
// degraded). The local fake-backends mode uses the in-memory recorder so the
// app runs with no vendor account.
export function createNotificationProvider(): NotificationProvider {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeProvider();
  }
  const apiToken = process.env.CF_EMAIL_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "CF_EMAIL_API_TOKEN is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createCloudflareEmailProvider({ apiToken });
}
