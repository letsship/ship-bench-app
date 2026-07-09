// Absolute site origin for canonical URLs, OG/Twitter tags, and the
// sitemap/robots files. Reads `NEXT_PUBLIC_SITE_URL` directly rather than
// through the zod `clientEnv`, which also requires Supabase credentials that
// these public, unauthenticated routes don't need.
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
