import { z } from "zod";

// Zod-validated environment access. Vars are read lazily when a dependent
// service is constructed — the fake-backends mode needs none of these set.
// After the Supabase→D1 migration, only the notification and URL vars remain.

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const serverSchema = clientSchema.extend({
  RESEND_API_KEY: z.string().min(1).optional(),
  STUDIOBOOK_FROM_EMAIL: z.string().min(1).optional(),
});

type ClientEnv = z.infer<typeof clientSchema>;
type ServerEnv = z.infer<typeof serverSchema>;

let cachedClientEnv: ClientEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

const getClientVars = () => ({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

const getServerVars = () => ({
  ...getClientVars(),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  STUDIOBOOK_FROM_EMAIL: process.env.STUDIOBOOK_FROM_EMAIL,
});

export const clientEnv = (): ClientEnv => {
  if (!cachedClientEnv) cachedClientEnv = clientSchema.parse(getClientVars());
  return cachedClientEnv;
};

export const serverEnv = (): ServerEnv => {
  if (!cachedServerEnv) cachedServerEnv = serverSchema.parse(getServerVars());
  return cachedServerEnv;
};