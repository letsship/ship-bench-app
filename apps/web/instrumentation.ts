import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

const sentryDsnSchema = z.string().url().optional();

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") {
    return;
  }

  const parsedDsn = sentryDsnSchema.safeParse(process.env.SENTRY_DSN);
  if (!parsedDsn.success || !parsedDsn.data) {
    return;
  }

  Sentry.init({ dsn: parsedDsn.data });
}
