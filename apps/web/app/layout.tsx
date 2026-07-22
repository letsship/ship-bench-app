import type { Metadata } from "next";
import type { ReactNode } from "react";
import { baseMetadata } from "@/lib/seo";
import "./global.css";

export const metadata: Metadata = {
  ...baseMetadata,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
