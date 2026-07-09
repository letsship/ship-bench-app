// Base URL for absolute links (canonical URLs, Open Graph, sitemap, robots).
// Read directly from process.env rather than the zod env schemas in `env.ts`
// — those require unrelated Supabase vars that fake-backend/vitest runs don't
// set, and this only needs a single optional URL string.

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl().replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
