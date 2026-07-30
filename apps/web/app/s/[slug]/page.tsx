import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { resolvePublicStudio } from "@/lib/services/public-studio";
import { serializeJsonLd, studioEventsJsonLd, studioPageMetadata } from "@/lib/seo";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone, including a crawler, can open it.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Studio-specific <head> metadata. A slug with no studio gets no metadata at
// all; the page itself renders the 404, so there is nothing to describe.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) return {};
  return studioPageMetadata(data.studio);
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const events = studioEventsJsonLd(studio, classes);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      {/* schema.org Event data, one entry per upcoming class, so search engines
          can surface the schedule as rich results. Serialized through
          serializeJsonLd so class and instructor names — free-form input shown
          here to anonymous visitors — cannot close the <script> element. */}
      {events.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(events) }}
        />
      )}

      <img src="/studio-cover.svg" width={96} height={96} alt={`${studio.name} studio logo`} />
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{studio.name}</h1>
      <h2 style={{ marginTop: 8, color: "#666", fontSize: 16, fontWeight: 400 }}>
        Upcoming classes
      </h2>

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
