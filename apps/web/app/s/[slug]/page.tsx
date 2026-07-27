import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { resolvePublicStudio, publicBaseUrl } from "@/lib/services/public-studio";
import { buildStudioJsonLd, buildStudioMetadata } from "./seo";

// Public, no-auth studio page. It lives OUTSIDE the (app) route group so the
// auth layout never runs — anyone can open it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) return { title: "Not Found" };

  const { studio, classes } = data;
  return buildStudioMetadata(studio, classes, publicBaseUrl());
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicStudioPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await resolvePublicStudio(slug);
  if (!data) notFound();

  const { studio, classes } = data;
  const timeZone = studio.timezone;
  const jsonLd = buildStudioJsonLd(studio, classes);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": jsonLd,
          }),
        }}
      />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <img src="/studio-cover.svg" width={96} height={96} alt={`${studio.name} logo`} />
        <div style={{ fontSize: 32, fontWeight: 700 }}>{studio.name}</div>
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
          <a href="/login">Book a class at {studio.name}</a>
        </div>
      </div>
    </>
  );
}
