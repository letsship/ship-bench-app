import { captureException } from "@sentry/nextjs";

// The app's error-reporting seam. Only genuinely unexpected failures come
// through here — handled outcomes (validation errors, HttpError) are normal
// responses and must never be reported, or the Sentry feed becomes noise.
// Keeping it a one-function module (like the notification provider seam) gives
// tests a single mock point and keeps the SDK out of the rest of the code.
// Sentry with no DSN configured is a no-op, so tests and fake-dev need no env.
export function reportError(error: unknown): void {
  captureException(error);
}
