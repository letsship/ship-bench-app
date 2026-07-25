import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

export function buildStudioMetadata(studio: Studio): Metadata {
  const siteUrl = publicBaseUrl();
  const studioUrl = publicStudioUrl(studio.slug);

  return {
    title: `${studio.name} - Classes & Schedule`,
    description: `Browse upcoming classes at ${studio.name}. Sign up for pilates, yoga, pottery, and more.`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: studioUrl,
    },
    openGraph: {
      type: "website",
      url: studioUrl,
      title: `${studio.name} - Classes & Schedule`,
      description: `Browse upcoming classes at ${studio.name}. Sign up for pilates, yoga, pottery, and more.`,
      siteName: "Studiobook",
      images: [
        {
          url: `${siteUrl}/studio-cover.svg`,
          width: 1200,
          height: 630,
          alt: `${studio.name} studio`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${studio.name} - Classes & Schedule`,
      description: `Browse upcoming classes at ${studio.name}. Sign up for pilates, yoga, pottery, and more.`,
      images: [
        {
          url: `${siteUrl}/studio-cover.svg`,
          width: 1200,
          height: 630,
          alt: `${studio.name} studio`,
        },
      ],
    },
  };
}

export function buildStudioEventsJsonLd(studio: Studio, classes: PublicClass[]): object {
  const siteUrl = publicBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: classes.map((cls, index) => ({
      "@type": "Event",
      "@context": "https://schema.org",
      position: index + 1,
      name: cls.name,
      startDate: cls.startsAt,
      endDate: cls.endsAt,
      location: {
        "@type": "Place",
        name: studio.name,
      },
      organizer: {
        "@type": "Organization",
        name: studio.name,
        url: publicStudioUrl(studio.slug),
      },
      image: `${siteUrl}/studio-cover.svg`,
      description: `${cls.name} class at ${studio.name} with instructor ${cls.instructor}`,
    })),
  };
}
