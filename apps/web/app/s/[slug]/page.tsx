import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { formatDateTime } from "@/lib/format";
import { buildStudioEventJsonLd, buildStudioMetadata } from "@/lib/seo/studio-metadata";
import {
  type PublicStudio,
  publicStudioUrl,
  resolvePublicStudio,
} from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone can open it. Indexable: real, studio-specific
// metadata (generateMetadata below) and schema.org Event JSON-LD replace the
// old blanket noindex + hardcoded "Studio" title.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata and the page component both need the same lookup; `cache`
// dedupes it to a single repository call per request.
const loadPublicStudio = cache((slug: string): Promise<PublicStudio | null> =>
  resolvePublicStudio(slug),
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicStudio(slug);
  if (!data) return {};
  return buildStudioMetadata(data.studio, publicStudioUrl(slug));
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadPublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const canonicalUrl = publicStudioUrl(slug);
  const jsonLd = buildStudioEventJsonLd(studio, classes, canonicalUrl);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <img src="/studio-cover.svg" width={96} height={96} alt={`${studio.name} studio`} />
      <div style={{ fontSize: 32, fontWeight: 700 }}>{studio.name}</div>
      <div style={{ marginTop: 8, color: "#666" }}>Upcoming classes</div>

      <div style={{ marginTop: 24 }}>
        {classes.length === 0 ? (
          <div>No upcoming classes are scheduled right now.</div>
        ) : (
          classes.map((cls) => (
            <div key={cls.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: 18 }}>{cls.name}</div>
              <div>{formatDateTime(cls.startsAt, timeZone)}</div>
              <div style={{ color: "#666" }}>with {cls.instructor}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <a href="/login">Sign in to book a class at {studio.name}</a>
      </div>
    </div>
  );
}
