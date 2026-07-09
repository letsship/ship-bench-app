import { z } from "zod";

// Zod-validated environment access, split into a client schema (NEXT_PUBLIC_*,
// safe for the browser bundle) and a server schema (everything). Vars are read
// by explicit property access so Next inlines NEXT_PUBLIC_* at build time.
// Parsing is lazy + cached, and only happens when a Supabase/email client is
// actually constructed — so the fake-backends mode needs none of these set.

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  STUDIOBOOK_FROM_EMAIL: z.string().min(1).optional(),
  POSTHOG_API_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().min(1).optional(),
  // Postgres schema the data lives in. Defaults to "public"; overridden per
  // deployment when a single database hosts several isolated copies of the app
  // (e.g. one schema per preview environment).
  SUPABASE_SCHEMA: z.string().min(1).default("public"),
});

type ClientEnv = z.infer<typeof clientSchema>;
type ServerEnv = z.infer<typeof serverSchema>;

let cachedClientEnv: ClientEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

const getClientVars = () => ({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

const getServerVars = () => ({
  ...getClientVars(),
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  STUDIOBOOK_FROM_EMAIL: process.env.STUDIOBOOK_FROM_EMAIL,
  POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
  POSTHOG_HOST: process.env.POSTHOG_HOST,
  SUPABASE_SCHEMA: process.env.SUPABASE_SCHEMA,
});

export const clientEnv = (): ClientEnv => {
  if (!cachedClientEnv) cachedClientEnv = clientSchema.parse(getClientVars());
  return cachedClientEnv;
};

export const serverEnv = (): ServerEnv => {
  if (!cachedServerEnv) cachedServerEnv = serverSchema.parse(getServerVars());
  return cachedServerEnv;
};
