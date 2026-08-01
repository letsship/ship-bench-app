import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

export function buildStudioMetadata(
  studio: Studio,
  classes: PublicClass[],
  baseUrl: string,
): Metadata {
  const title = `${studio.name} | Upcoming Classes`;
  const description = `${studio.name} — discover ${classes.length ? "upcoming" : "future"} classes, times, and instructors.`;
  const url = `${baseUrl}/s/${studio.slug}`;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

export function buildEventJsonLd(studio: Studio, classes: PublicClass[]) {
  return classes.map((classItem) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: classItem.name,
    startDate: classItem.startsAt,
    location: { "@type": "Place", name: studio.name },
  }));
}
