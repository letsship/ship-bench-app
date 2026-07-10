import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { buildStudioEventsJsonLd } from "@/lib/seo/studio-jsonld";
import { publicBaseUrl, publicStudioUrl, resolvePublicStudio } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone can open it.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Search engines need to see the studio's own name/description, not the
// generic app shell — so this is generated per slug rather than a static
// `export const metadata`. An unknown slug is left unindexed; the page itself
// still 404s via notFound() below.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) {
    return { robots: { index: false, follow: false } };
  }

  const { studio } = data;
  const canonicalUrl = publicStudioUrl(studio.slug);
  const title = `${studio.name} — book a class`;
  const description = `See upcoming classes at ${studio.name} and book your spot online.`;

  return {
    metadataBase: new URL(publicBaseUrl()),
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

// Escape "<" so a class/instructor name can never prematurely close the
// <script> tag the JSON-LD block is embedded in.
function toJsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const canonicalUrl = publicStudioUrl(studio.slug);
  const jsonLd = buildStudioEventsJsonLd(studio, classes, canonicalUrl);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      {jsonLd.length > 0 && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires a raw <script> body; content is escaped above.
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdScript(jsonLd) }}
        />
      )}
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
        <a href="/login">Book a class at {studio.name}</a>
      </div>
    </div>
  );
}
