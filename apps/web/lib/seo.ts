import type { Metadata } from "next";

// Site configuration with URL sourced from environment
// NEXT_PUBLIC_SITE_URL is defined in .env and deployed settings
// Falls back to a documented example URL if unset (e.g., development without env var)
export const siteConfig = {
  name: "Studiobook",
  description: "Bookings, members, and invoicing for movement studios.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://studiobook.example",
};

// Base metadata applied to all pages via layout.tsx
// Includes metadataBase (for canonical URLs and social cards),
// robots index/follow, and standard Open Graph / Twitter tags
export const baseMetadata: Metadata = {
  title: {
    template: "%s | Studiobook",
    default: "Studiobook — studio class booking",
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.siteUrl),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    title: "Studiobook — studio class booking",
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Studiobook — studio class booking",
    description: siteConfig.description,
  },
};

// Home page metadata: full URL, canonical, and page-specific title
export const homeMetadata: Metadata = {
  title: "Studiobook — studio class booking",
  description: siteConfig.description,
  alternates: {
    canonical: new URL("/", siteConfig.siteUrl).toString(),
  },
  openGraph: {
    type: "website",
    url: new URL("/", siteConfig.siteUrl).toString(),
    title: "Studiobook — studio class booking",
    description: siteConfig.description,
  },
};

// Public routes for sitemap.xml
export const sitemapEntries = () => [
  {
    url: new URL("/", siteConfig.siteUrl).toString(),
    lastModified: new Date().toISOString().split("T")[0],
    changeFrequency: "weekly" as const,
    priority: 1.0,
  },
  {
    url: new URL("/login", siteConfig.siteUrl).toString(),
    lastModified: new Date().toISOString().split("T")[0],
    changeFrequency: "monthly" as const,
    priority: 0.8,
  },
];
