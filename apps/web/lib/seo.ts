import type { Metadata } from "next";

// Resolve siteUrl from env with a fallback. In production, set NEXT_PUBLIC_SITE_URL
// to the deployment domain so canonical and OpenGraph URLs resolve absolutely.
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://studiobook.app";

// Validate that siteUrl is absolute.
if (!siteUrl.startsWith("http://") && !siteUrl.startsWith("https://")) {
  throw new Error(`siteUrl must be an absolute URL, got: ${siteUrl}`);
}

export const homeMetadata: Metadata = {
  title: "Studiobook — studio class booking",
  description: "Bookings, members, and invoicing for movement studios.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Studiobook — studio class booking",
    description: "Bookings, members, and invoicing for movement studios.",
    type: "website",
    url: "/",
  },
  twitter: {
    title: "Studiobook — studio class booking",
    description: "Bookings, members, and invoicing for movement studios.",
  },
};
