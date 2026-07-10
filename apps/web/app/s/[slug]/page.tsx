import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { resolveRepositories } from "@/lib/db/repos";
import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { formatDate, formatTime } from "@/lib/format";
import { HttpError } from "@/lib/http";
import { listSessions } from "@/lib/services/classes";
import { getPublicStudioBySlug } from "@/lib/services/studio";

// Public, unauthenticated studio page — outside the `(app)` route group, so it
// is never gated by AppLayout's session check. Search engines and unauthed
// visitors both hit this route directly.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Shared by generateMetadata and the page body so the slug→studio lookup only
// runs once per request (React dedupes cache() calls within a render pass).
const loadStudio = cache(async (slug: string): Promise<{ repos: Repositories; studio: Studio }> => {
  const repos = await resolveRepositories();
  try {
    const studio = await getPublicStudioBySlug(repos, slug);
    return { repos, studio };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { studio } = await loadStudio(slug);
  const url = `${siteUrl()}/s/${studio.slug}`;
  const title = `${studio.name} — classes & bookings`;
  const description = `See the upcoming class schedule at ${studio.name} and book your spot.`;

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

// Escape `<` so a class/instructor name can never prematurely close the
// surrounding <script> tag when the JSON-LD payload is inlined below.
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const { repos, studio } = await loadStudio(slug);
  const sessions = await listSessions(repos, studio.id, { from: new Date().toISOString() });

  const events = sessions.map((session) => ({
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(events) }} />

      <Image
        src="/studio-placeholder.svg"
        alt={`${studio.name} studio space`}
        width={960}
        height={480}
        className="h-auto w-full rounded-xl border border-[var(--color-line)]"
        priority
      />

      <h1 className="mt-6 text-4xl">{studio.name}</h1>
      <p className="mt-2 text-[var(--color-muted)]">Upcoming classes at {studio.name}.</p>

      <section
        className="sb-card mt-8 divide-y divide-[var(--color-line)]"
        data-testid="upcoming-classes"
      >
        {sessions.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-muted)]">
            No upcoming classes are scheduled right now — check back soon.
          </p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="p-4">
              <div className="font-medium">{session.classTypeName}</div>
              <div className="text-sm text-[var(--color-muted)]">
                {formatDate(session.startsAt, studio.timezone)} at{" "}
                {formatTime(session.startsAt, studio.timezone)} · {session.instructor}
              </div>
            </div>
          ))
        )}
      </section>

      <Link href="/login" className="sb-btn sb-btn-primary mt-8 inline-flex">
        Sign in to book a class at {studio.name}
      </Link>
    </main>
  );
}
