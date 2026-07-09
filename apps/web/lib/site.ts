// The public site origin used for canonical/OG URLs, the sitemap, and robots.
// Read directly from process.env (not the zod-validated `clientEnv()`) so it
// works in fake-backend/test/build environments that don't set Supabase vars.
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
