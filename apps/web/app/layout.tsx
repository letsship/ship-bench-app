import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./global.css";
import { buildPageMetadata, getSiteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Studiobook — studio class booking",
    description: "Bookings, members, and invoicing for movement studios.",
  }),
  metadataBase: new URL(getSiteUrl()),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
