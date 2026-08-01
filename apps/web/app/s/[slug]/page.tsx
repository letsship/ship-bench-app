import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { buildStudioEventJsonLd, buildStudioMetadata } from "@/lib/seo";
import { publicBaseUrl, resolvePublicStudio } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone (including search-engine crawlers) can open it.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Studio-specific, indexable metadata: real title/description, Open Graph and
// Twitter tags, and a canonical URL. An unknown slug falls through to the page's
// notFound(), so no metadata is needed for it.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) return {};
  return buildStudioMetadata(data.studio, data.classes, publicBaseUrl());
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const jsonLd = buildStudioEventJsonLd(studio, classes, publicBaseUrl());

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <img src="/studio-cover.svg" alt={`${studio.name} studio logo`} width={96} height={96} />
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>{studio.name}</h1>
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
        <a href="/login">Book a class at {studio.name}</a>
      </div>
    </div>
  );
}
