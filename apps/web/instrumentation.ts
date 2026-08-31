import * as Sentry from "@sentry/nextjs";
import { sentryDsn } from "./lib/env";

export function register() {
  const dsn = sentryDsn();
  if (dsn) Sentry.init({ dsn });
}
