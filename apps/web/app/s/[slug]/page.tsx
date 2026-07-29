import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { siteUrl, studioEventsJsonLd, studioMetadata } from "@/lib/seo";
import { resolvePublicStudio } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone, including search-engine crawlers, can open
// it. It is deliberately indexable: generateMetadata emits studio-specific
// title/description, Open Graph + Twitter card tags, and a canonical URL, and
// the page embeds one schema.org Event per upcoming class as JSON-LD.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) return {};
  return studioMetadata(data.studio, data.classes, siteUrl());
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const eventsJsonLd = studioEventsJsonLd(studio, classes, siteUrl());

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventsJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <img src="/studio-cover.svg" width={96} height={96} alt={`${studio.name} cover`} />
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
