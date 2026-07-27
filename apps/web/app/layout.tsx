import type { ReactNode } from "react";
import type { Viewport } from "next";
import { siteMetadata } from "@/lib/seo";
import "./global.css";

export const metadata = siteMetadata;

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
