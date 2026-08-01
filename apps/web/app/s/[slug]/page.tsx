import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { buildEventJsonLd, siteUrl, studioUrl } from "@/lib/seo";
import { getPublicStudioBySlug } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function studioDescription(studioName: string): string {
  return `Explore upcoming classes and book your next visit at ${studioName}.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicStudioBySlug(slug);
  if (!data) return { title: "Studio not found" };

  const { studio } = data;
  const title = `${studio.name} | Upcoming classes`;
  const description = studioDescription(studio.name);
  const url = studioUrl(studio.slug);
  const imageAlt = `${studio.name} — movement studio`;

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      images: [{ url: "/studio-cover.svg", width: 96, height: 96, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/studio-cover.svg"],
    },
  };
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPublicStudioBySlug(slug);
  if (!data) notFound();

  const { studio, sessions } = data;
  const events = buildEventJsonLd(studio, sessions);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <img
        src="/studio-cover.svg"
        width={96}
        height={96}
        alt={`${studio.name} — movement studio`}
      />
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>{studio.name}</h1>
      <p style={{ marginTop: 8, color: "#666" }}>Upcoming classes</p>

      <section style={{ marginTop: 24 }} aria-label={`Upcoming classes at ${studio.name}`}>
        {sessions.length === 0 ? (
          <p>No upcoming classes are scheduled right now.</p>
        ) : (
          sessions.map((session) => (
            <article
              key={session.id}
              style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}
            >
              <h2 style={{ fontSize: 18 }}>{session.classTypeName}</h2>
              <time dateTime={session.startsAt}>
                {formatDateTime(session.startsAt, studio.timezone)}
              </time>
              <p style={{ color: "#666" }}>Instructor: {session.instructor}</p>
            </article>
          ))
        )}
      </section>

      <p style={{ marginTop: 32 }}>
        <a href="/login">Book a class at {studio.name}</a>
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(events).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
