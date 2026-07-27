import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { buildStudioEventsJsonLd, serializeJsonLd, studioMetadata } from "@/lib/seo";
import { resolvePublicStudio } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone can open it.
export const dynamic = "force-dynamic";

// `generateMetadata` and the page component both need the same data; `cache`
// dedupes the repository round-trip to one call per request.
const getPublicStudio = cache(resolvePublicStudio);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicStudio(slug);
  if (!data) return { title: "Studio not found", robots: { index: false, follow: false } };
  return studioMetadata(data, slug);
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const jsonLd = buildStudioEventsJsonLd(data);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script
        type="application/ld+json"
        // JSON.stringify doesn't escape "<", ">", "&", or the JS line
        // terminators U+2028/U+2029, so a studio/class name containing e.g.
        // "</script>" would otherwise break out of this tag and execute on
        // this public, unauthenticated page. \uXXXX escapes are valid JSON
        // and round-trip back to the original characters when parsed.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <img
        src="/studio-cover.svg"
        width={96}
        height={96}
        alt={`${studio.name} studio cover photo`}
      />
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
