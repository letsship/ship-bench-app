import type { Metadata } from "next";

// Derive the site URL from environment or use a documented fallback.
// NEXT_PUBLIC_SITE_URL is optional; in production, it should be set to the
// canonical domain (e.g., https://app.example.com). The fallback is used for
// builds and tests that do not specify the var.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://studiobook.example";

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Studiobook — studio class booking",
    template: "%s | Studiobook",
  },
  description:
    "Bookings, members, and invoicing for movement studios. Run your studio, not a spreadsheet.",
  keywords: ["studio management", "class booking", "member management", "invoicing", "scheduling"],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Studiobook",
    url: "/",
    title: "Studiobook — studio class booking",
    description:
      "Bookings, members, and invoicing for movement studios. Run your studio, not a spreadsheet.",
  },
  twitter: {
    card: "summary",
  },
};

export const homeMetadata: Metadata = {
  title: "Studiobook — studio class booking",
  description:
    "Run your studio, not a spreadsheet. Studiobook keeps your pottery wheels spinning and your yoga mats full — bookings, members, and invoices in one calm workspace.",
  alternates: {
    canonical: "/",
  },
};
