import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveRepositories } from "@/lib/db/repos";
import { formatDateTime } from "@/lib/format";
import { HttpError } from "@/lib/http";
import { getPublicStudioBySlug } from "@/lib/services/public-studio";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function loadPublicStudio(slug: string) {
  const repos = await resolveRepositories();
  try {
    return await getPublicStudioBySlug(repos, slug);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicStudio(slug);
  if (!data) return {};

  const { studio } = data;
  const title = `${studio.name} — Classes & schedule`;
  const description = `See upcoming classes at ${studio.name} and sign up.`;
  const url = `${getSiteUrl()}/s/${studio.slug}`;

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
  const data = await loadPublicStudio(slug);
  if (!data) notFound();

  const { studio, upcomingClasses } = data;
  const siteUrl = getSiteUrl();

  const jsonLd = upcomingClasses.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.classTypeName,
    startDate: session.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: session.instructor,
    },
    url: `${siteUrl}/s/${studio.slug}`,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <h1 className="text-4xl">{studio.name}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Upcoming classes</p>

      <div className="sb-card mt-8 overflow-x-auto">
        {upcomingClasses.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-muted)]">No upcoming classes scheduled.</p>
        ) : (
          <table className="sb-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Starts</th>
                <th>Instructor</th>
              </tr>
            </thead>
            <tbody>
              {upcomingClasses.map((session) => (
                <tr key={session.id}>
                  <td>{session.classTypeName}</td>
                  <td className="whitespace-nowrap">
                    {formatDateTime(session.startsAt, studio.timezone)}
                  </td>
                  <td className="text-[var(--color-muted)]">{session.instructor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
