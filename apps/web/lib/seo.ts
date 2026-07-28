export const SITE_NAME = "Studiobook";
export const SITE_DESCRIPTION = "Bookings, members, and invoicing for movement studios.";

const DEFAULT_SITE_URL = "https://studiobook.app";

export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  // Normalize by removing trailing slash
  return url.replace(/\/$/, "");
}
