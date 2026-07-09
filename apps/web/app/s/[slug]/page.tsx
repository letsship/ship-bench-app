import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveRepositories } from "@/lib/db/repos";
import { formatDateTime } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import { getPublicStudioBySlug } from "@/lib/services/public-studio";

// PUBLIC page — deliberately outside the `(app)` route group, so none of that
// layout's auth checks (`getSession()` / redirect to `/login`) apply here.
// Anyone, including search crawlers, can load this without a session.

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function describeStudio(name: string, classCount: number): string {
  return classCount > 0
    ? `See upcoming classes at ${name} and book your spot.`
    : `Discover ${name} — check back soon for upcoming classes.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const result = await getPublicStudioBySlug(repos, slug);
  if (!result) return {};

  const { studio, classes } = result;
  const title = `${studio.name} — classes & schedule`;
  const description = describeStudio(studio.name, classes.length);
  const url = absoluteUrl(`/s/${studio.slug}`);

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

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const result = await getPublicStudioBySlug(repos, slug);
  if (!result) notFound();

  const { studio, classes } = result;

  const jsonLd = classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        // Payload is built entirely from our own studio/class fields, not raw
        // user input, so JSON.stringify here carries no XSS risk.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-4xl">{studio.name}</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        {describeStudio(studio.name, classes.length)}
      </p>

      <section className="mt-10">
        <h2 className="text-xl">Upcoming classes</h2>
        {classes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No upcoming classes are scheduled yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {classes.map((cls) => (
              <li key={cls.id} className="sb-card p-4">
                <div className="font-semibold">{cls.name}</div>
                <div className="text-sm text-[var(--color-muted)]">
                  {formatDateTime(cls.startsAt, studio.timezone)} · {cls.instructor}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
