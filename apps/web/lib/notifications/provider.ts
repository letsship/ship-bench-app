import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
import { createFakeProvider } from "./fake-provider";
import type { NotificationProvider } from "./types";

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