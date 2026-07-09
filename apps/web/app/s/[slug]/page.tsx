import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveRepositories } from "@/lib/db/repos";
import { formatDateTime } from "@/lib/format";
import { HttpError } from "@/lib/http";
import { getPublicStudioBySlug } from "@/lib/services/public-studio";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function describeStudio(name: string): string {
  return `See upcoming classes at ${name} and sign up to join.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = await resolveRepositories();
  let studio;
  try {
    ({ studio } = await getPublicStudioBySlug(repos, slug));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return {};
    throw error;
  }

  const title = `${studio.name} — upcoming classes`;
  const description = describeStudio(studio.name);
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
      card: "summary",
      title,
      description,
    },
  };
}

// Escape `<` so a studio/instructor name containing "</script>" can't break
// out of the JSON-LD script tag it's serialized into below.
function toJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const repos = await resolveRepositories();

  let studio;
  let upcomingSessions;
  try {
    ({ studio, upcomingSessions } = await getPublicStudioBySlug(repos, slug));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  const events = upcomingSessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.classTypeName,
    startDate: session.startsAt,
    endDate: session.endsAt,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(events) }} />
      <h1 className="text-4xl leading-tight">{studio.name}</h1>
      <p className="mt-3 text-lg text-[var(--color-muted)]">{describeStudio(studio.name)}</p>

      <section className="mt-10">
        <h2 className="text-xl">Upcoming classes</h2>
        {upcomingSessions.length === 0 ? (
          <p className="mt-4 text-[var(--color-muted)]">
            No upcoming classes are scheduled right now.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcomingSessions.map((session) => (
              <li key={session.id} className="sb-card p-4">
                <div className="font-medium">{session.classTypeName}</div>
                <div className="text-sm text-[var(--color-muted)]">
                  {formatDateTime(session.startsAt, studio.timezone)} — {session.instructor}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
