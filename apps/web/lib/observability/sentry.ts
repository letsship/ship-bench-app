import { captureException } from "@sentry/nextjs";

export function reportUnexpectedError(error: unknown): void {
  captureException(error);
}