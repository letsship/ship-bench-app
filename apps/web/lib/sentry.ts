import * as Sentry from "@sentry/nextjs";

// Reports a genuinely unexpected error to Sentry. Awaited by callers: on this
// app's Cloudflare Workers/OpenNext deploy, the request context ends once the
// response is sent, so un-awaited async work (including this capture) would
// be silently dropped without the explicit flush.
export async function captureUnexpectedError(error: unknown): Promise<void> {
  Sentry.captureException(error);
  await Sentry.flush(2000);
}
