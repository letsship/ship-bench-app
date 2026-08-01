import type { Studio } from "@/lib/db/types";
import type { SessionView } from "@/lib/services/classes";

const localhostUrl = "http://localhost:3000";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? localhostUrl).replace(/\/+$/, "");
}

export function studioPath(slug: string): string {
  return `/s/${encodeURIComponent(slug)}`;
}

export function studioUrl(slug: string): string {
  return `${siteUrl()}${studioPath(slug)}`;
}

export function buildEventJsonLd(studio: Studio, sessions: SessionView[]) {
  return sessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.classTypeName,
    startDate: session.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
  }));
}
