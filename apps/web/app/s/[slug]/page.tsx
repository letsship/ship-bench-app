import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { resolveRepositories } from "@/lib/db/repos";
import { formatDateTime } from "@/lib/format";
import {
  buildStudioEventJsonLd,
  buildStudioMetadata,
  siteBaseUrl,
} from "@/lib/seo/studio-seo";
import { listSessions } from "@/lib/services/classes";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const resolveStudioPage = cache(async (slug: string) => {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();
  if (!studio || studio.slug !== slug) return null;

  const sessions = await listSessions(repos, studio.id, { from: new Date().toISOString() });
  return { studio, sessions };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolveStudioPage(slug);
  if (!data) notFound();

  return buildStudioMetadata(data.studio, siteBaseUrl());
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolveStudioPage(slug);
  if (!data) notFound();

  const { studio, sessions } = data;
  const eventJsonLd = buildStudioEventJsonLd(studio, sessions, siteBaseUrl());

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="flex items-center gap-5">
        <Image
          src="/studio-cover.svg"
          width={96}
          height={96}
          alt={`${studio.name} studio`}
          priority
        />
        <div>
          <h1 className="text-4xl font-bold">{studio.name}</h1>
          <p className="mt-2 text-[var(--color-muted)]">Upcoming classes</p>
        </div>
      </header>

      <section className="mt-8" aria-labelledby="upcoming-classes-heading">
        <h2 id="upcoming-classes-heading" className="sr-only">
          Upcoming classes at {studio.name}
        </h2>
        {sessions.length === 0 ? (
          <p>No upcoming classes are scheduled right now.</p>
        ) : (
          sessions.map((session) => (
            <article
              id={`class-${session.id}`}
              key={session.id}
              className="border-b border-[var(--color-line)] py-4"
            >
              <h3 className="text-lg font-semibold">{session.classTypeName}</h3>
              <time dateTime={session.startsAt}>
                {formatDateTime(session.startsAt, studio.timezone)}
              </time>
              <p className="text-[var(--color-muted)]">with {session.instructor}</p>
            </article>
          ))
        )}
      </section>

      <div className="mt-8">
        <Link href="/login" className="sb-btn sb-btn-primary">
          Book a class at {studio.name}
        </Link>
      </div>
    </main>
  );
}
