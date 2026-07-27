import type { Metadata } from "next";
import type { PublicStudio } from "@/lib/services/public-studio";
import { publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// SEO metadata + structured data for the public studio page. Pure functions so
// they're unit-testable without rendering the page itself.

function describeStudio(data: PublicStudio): string {
  const { studio, classes } = data;
  if (classes.length === 0) return `See upcoming classes and book your spot at ${studio.name}.`;
  const names = classes.slice(0, 3).map((cls) => cls.name);
  return `Book ${names.join(", ")} and other upcoming classes at ${studio.name}.`;
}

export function studioMetadata(data: PublicStudio, slug: string): Metadata {
  const { studio } = data;
  const title = `${studio.name} — classes & schedule`;
  const description = describeStudio(data);
  const url = publicStudioUrl(slug);
  const image = `${publicBaseUrl()}/studio-cover.svg`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [image],
    },
  };
}

// One schema.org Event per upcoming class, so search engines can show rich
// results (dates, location) for the studio's schedule.
export function buildStudioEventsJsonLd(data: PublicStudio): Record<string, unknown>[] {
  const { studio, classes } = data;
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
  }));
}
