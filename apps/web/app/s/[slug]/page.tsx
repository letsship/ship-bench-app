import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { resolveRepositories } from "@/lib/db/repos";
import {
  buildStudioPageJsonLd,
  buildStudioPageMetadata,
} from "@/lib/seo/studio";
import { getPublicStudioBySlug } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone can open it, including search-engine crawlers.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Studio-specific SEO metadata via Next's Metadata API: a <title> and
// <meta name="description"> that name the studio, Open Graph tags, a Twitter
// card, and a canonical URL. No noindex — the page is crawlable.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const data = await getPublicStudioBySlug(repos, slug);
  if (!data) return { title: "Studio not found" };
  return buildStudioPageMetadata(data);
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const data = await getPublicStudioBySlug(repos, slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const jsonLd = buildStudioPageJsonLd(data);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <img
        src="/studio-cover.svg"
        width={96}
        height={96}
        alt={`${studio.name} studio cover`}
      />
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{studio.name}</h1>
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
