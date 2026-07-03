import { createMailjayProvider } from "./mailjay-provider";
import type { NotificationProvider } from "./types";

// The app's notification provider. Defaults to the in-memory mailjay transport
// so Studiobook runs with no vendor account; a real deployment supplies
// MAILJAY_API_KEY (and the SDK would swap in a fetch-backed transport).
export function createNotificationProvider(): NotificationProvider {
  return createMailjayProvider({
    apiKey: process.env.MAILJAY_API_KEY ?? "mj_dev_key",
    from: process.env.STUDIOBOOK_FROM_EMAIL ?? "hello@riverbank.studio",
  });
}
