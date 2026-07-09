import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveRepositories } from "@/lib/db/repos";
import { formatDateTime } from "@/lib/format";
import { publicBaseUrl, publicStudioUrl, resolvePublicStudio } from "@/lib/services/public-studio";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone can open it.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Studio-specific title/description/canonical/social tags so each studio's
// page can actually rank and preview well when shared, instead of every
// studio sharing one generic "Studio" title. A miss just falls through to
// notFound() in the page body below, so metadata here can stay minimal.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const data = await resolvePublicStudio(repos, slug);
  if (!data) return { title: "Studio not found" };

  const { studio } = data;
  const title = `${studio.name} — Class Schedule & Booking`;
  const description = `See upcoming classes at ${studio.name} and sign in to book your spot.`;
  const url = publicStudioUrl(slug);

  return {
    metadataBase: new URL(publicBaseUrl()),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: ["/studio-cover.svg"],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/studio-cover.svg"],
    },
  };
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const data = await resolvePublicStudio(repos, slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;

  const events = classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
  }));
  // Escape "<" so a class/instructor name containing "</script>" can't break
  // out of the JSON-LD block — the standard guard for embedding JSON in HTML.
  const jsonLd = JSON.stringify(events).replace(/</g, "\\u003c");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <img src="/studio-cover.svg" width={96} height={96} alt={`${studio.name} studio`} />
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
        <a href="/login">Sign in to book a class at {studio.name}</a>
      </div>
    </div>
  );
}
