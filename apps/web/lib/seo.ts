import type { Metadata } from "next";

// Deliberately reads process.env directly instead of lib/env.ts's clientEnv(),
// which eagerly requires Supabase vars to be set/valid — module-scope metadata
// construction in layout.tsx must not force that dependency.
export const getSiteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const SITE_NAME = "Studiobook";

type PageMetadataInput = {
  title: string;
  description: string;
  type?: "website" | "article" | "profile";
};

export const buildPageMetadata = ({
  title,
  description,
  type = "website",
}: PageMetadataInput): Metadata => ({
  title,
  description,
  openGraph: {
    title,
    description,
    type,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
});
