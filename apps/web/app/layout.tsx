import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_DESCRIPTION, siteUrl } from "@/lib/seo";
import "./global.css";

export const metadata: Metadata = {
  title: "Studiobook — studio class booking",
  description: SITE_DESCRIPTION,
  metadataBase: new URL(siteUrl()),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    url: "/",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
