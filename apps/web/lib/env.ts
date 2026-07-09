import { z } from "zod";

// Zod-validated environment access, split into a client schema (NEXT_PUBLIC_*,
// safe for the browser bundle) and a server schema (everything). Vars are read
// by explicit property access so Next inlines NEXT_PUBLIC_* at build time.
// Parsing is lazy + cached, and only happens when an email client is actually
// constructed — so the fake-backends mode needs none of these set. Persistence
// needs no vars here: the D1 binding is injected by the Worker runtime.

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
