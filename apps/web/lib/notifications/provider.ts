import { createFakeProvider } from "./fake-provider";
import { createResendProvider } from "./resend-provider";
import type { NotificationProvider } from "./types";

// The app's notification provider. Production uses Resend (a real API key is
// required — a missing key is surfaced as an error, never silently degraded).
// The local fake-backends mode uses the in-memory recorder so the app runs with
// no vendor account.
export function createNotificationProvider(): NotificationProvider {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeProvider();
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createResendProvider({
    apiKey,
    from: process.env.STUDIOBOOK_FROM_EMAIL ?? "Studiobook <hello@riverbank.studio>",
  });
}
