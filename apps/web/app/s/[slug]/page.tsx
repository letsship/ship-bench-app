import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveRepositories } from "@/lib/db/repos";
import { siteUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getPublicStudioBySlug } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// A flat neutral placeholder — the demo dataset has no per-studio photo, so
// this avoids depending on an asset file that doesn't exist yet.
const PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="320"><rect width="100%" height="100%" fill="#e7e2d8"/></svg>',
)}`;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const data = await getPublicStudioBySlug(repos, slug);
  if (!data) return {};

  const { studio } = data;
  const title = `${studio.name} — classes & schedule`;
  const description = `See upcoming classes at ${studio.name} and book your spot.`;
  const url = `${siteUrl()}/s/${studio.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const data = await getPublicStudioBySlug(repos, slug);
  if (!data) notFound();

  const { studio, upcomingSessions } = data;
  const timeZone = studio.timezone;

  const jsonLd = upcomingSessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.name,
    startDate: session.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: session.instructor,
    },
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <img
        src={PLACEHOLDER_IMAGE}
        alt={`${studio.name} studio`}
        width={960}
        height={320}
        className="w-full rounded-xl object-cover"
      />

      <h1 className="mt-8 text-4xl">{studio.name}</h1>
      <p className="mt-2 text-[var(--color-muted)]">Upcoming classes at {studio.name}.</p>

      {upcomingSessions.length === 0 ? (
        <div className="sb-card mt-8 p-10 text-center text-sm text-[var(--color-muted)]">
          No upcoming classes are scheduled right now.
        </div>
      ) : (
        <div className="sb-card mt-8 overflow-hidden">
          <table className="sb-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Starts</th>
                <th>Instructor</th>
              </tr>
            </thead>
            <tbody>
              {upcomingSessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.name}</td>
                  <td>{formatDateTime(session.startsAt, timeZone)}</td>
                  <td>{session.instructor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <Link href="/login" className="sb-btn sb-btn-primary">
          View {studio.name}&rsquo;s class schedule and book a spot
        </Link>
      </div>
    </main>
  );
}
