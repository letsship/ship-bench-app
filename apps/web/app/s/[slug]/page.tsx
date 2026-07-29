import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatDateTime } from "@/lib/format";
import { buildStudioEventJsonLd, buildStudioMetadata } from "@/lib/seo";
import { resolvePublicStudio } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone (including search crawlers) can open it.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Studio-specific SEO metadata: a real title/description naming the studio,
// Open Graph + Twitter cards, and a canonical URL. Deliberately no `noindex` —
// the page is meant to be indexed. Returns an empty title only if the studio is
// missing (Next still renders the 404 from notFound()).
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) return { title: "Studio not found" };
  return buildStudioMetadata(data);
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const events = buildStudioEventJsonLd(data);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(events) }}
      />

      <img
        src="/studio-cover.svg"
        width={96}
        height={96}
        alt={`${studio.name} studio logo`}
      />
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: "12px 0 0" }}>{studio.name}</h1>
      <div style={{ marginTop: 8, color: "#666" }}>Upcoming classes</div>

      <div style={{ marginTop: 24 }}>
        {classes.length === 0 ? (
          <div>No upcoming classes are scheduled right now.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {classes.map((cls) => (
              <li key={cls.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 18 }}>{cls.name}</div>
                <div>{formatDateTime(cls.startsAt, timeZone)}</div>
                <div style={{ color: "#666" }}>with {cls.instructor}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <a href="/login">{`Book a class at ${studio.name}`}</a>
      </div>
    </div>
  );
}
