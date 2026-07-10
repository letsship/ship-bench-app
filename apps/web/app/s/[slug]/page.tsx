import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveRepositories } from "@/lib/db/repos";
import { formatDateTime } from "@/lib/format";
import {
  buildStudioJsonLd,
  buildStudioMetaDescription,
  getPublicStudioPage,
  getStudioPageUrl,
} from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const page = await getPublicStudioPage(repos, slug);
  if (!page) return { title: "Studio not found" };

  const { studio } = page;
  const title = `${studio.name} — classes & booking`;
  const description = buildStudioMetaDescription(studio);
  const canonicalUrl = getStudioPageUrl(studio);

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const repos = await resolveRepositories();
  const page = await getPublicStudioPage(repos, slug);
  if (!page) notFound();

  const { studio, upcomingSessions } = page;
  const canonicalUrl = getStudioPageUrl(studio);
  const jsonLd = buildStudioJsonLd(studio, upcomingSessions, canonicalUrl);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <img
        src="/studio-placeholder.svg"
        alt={`${studio.name} studio`}
        width={1200}
        height={630}
        className="sb-card w-full"
      />

      <h1 className="mt-8 text-4xl">{studio.name}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{buildStudioMetaDescription(studio)}</p>

      <h2 className="mb-3 mt-10 text-xl">Upcoming classes</h2>
      {upcomingSessions.length === 0 ? (
        <p className="text-[var(--color-muted)]">No upcoming classes are scheduled right now.</p>
      ) : (
        <div className="sb-card overflow-hidden">
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
                  <td>{session.classTypeName}</td>
                  <td className="whitespace-nowrap">
                    {formatDateTime(session.startsAt, studio.timezone)}
                  </td>
                  <td>{session.instructor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link href="/login" className="sb-btn sb-btn-primary mt-10 inline-flex">
        Sign in to book a class at {studio.name}
      </Link>
    </main>
  );
}
