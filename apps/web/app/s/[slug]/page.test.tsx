import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType, Studio, StudioSettings } from "@/lib/db/types";
import PublicStudioPage, { generateMetadata } from "./page";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 90_000_000).toISOString();

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank-movement",
  timezone: "Europe/Amsterdam",
  createdAt: ISO,
};

const settings: StudioSettings = {
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
};

const session: ClassSession = {
  id: "cs1",
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Amara Okafor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
};

function seed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio,
    settings,
    members: [],
    classTypes: [classType],
    sessions: [session],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

function isElement(node: unknown): node is ReactElement {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

// The page is a server component: calling it directly returns a plain React
// element tree (no DOM/jsdom needed). Walk it to find nodes by predicate.
function findAll(
  node: ReactNode,
  predicate: (el: ReactElement) => boolean,
  acc: ReactElement[] = [],
): ReactElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }
  if (!isElement(node)) return acc;
  if (predicate(node)) acc.push(node);
  const children = (node.props as { children?: ReactNode }).children;
  if (children !== undefined) findAll(children, predicate, acc);
  return acc;
}

afterEach(() => {
  __setTestRepositories(null);
});

describe("PublicStudioPage", () => {
  it("renders the studio name and each upcoming class's name, start time, and instructor", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const element = await PublicStudioPage({ params: Promise.resolve({ slug: studio.slug }) });
    const text = JSON.stringify(element);

    expect(text).toContain(studio.name);
    expect(text).toContain(classType.name);
    expect(text).toContain(session.instructor);
  });

  it("gives the studio image descriptive alt text", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const element = await PublicStudioPage({ params: Promise.resolve({ slug: studio.slug }) });
    const [img] = findAll(element, (el) => el.type === "img");

    expect(img).toBeDefined();
    expect((img.props as { alt?: string }).alt).toBeTruthy();
    expect((img.props as { alt?: string }).alt).toContain(studio.name);
  });

  it("uses a descriptive call-to-action link, not 'Click here'", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const element = await PublicStudioPage({ params: Promise.resolve({ slug: studio.slug }) });
    const [cta] = findAll(element, (el) => el.type === "a");

    expect(cta).toBeDefined();
    const ctaText = JSON.stringify((cta.props as { children?: ReactNode }).children);
    expect(ctaText).not.toContain("Click here");
    expect(ctaText).toContain(studio.name);
  });

  it("embeds a schema.org Event JSON-LD script", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const element = await PublicStudioPage({ params: Promise.resolve({ slug: studio.slug }) });
    const [script] = findAll(element, (el) => el.type === "script");

    expect(script).toBeDefined();
    expect((script.props as { type?: string }).type).toBe("application/ld+json");
    const html = (script.props as { dangerouslySetInnerHTML?: { __html: string } })
      .dangerouslySetInnerHTML;
    const events = JSON.parse(html?.__html ?? "[]") as Record<string, unknown>[];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      "@type": "Event",
      name: classType.name,
      startDate: session.startsAt,
    });
    expect(events[0].location).toBeTruthy();
  });

  it("calls notFound() for a slug that matches no studio", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    await expect(
      PublicStudioPage({ params: Promise.resolve({ slug: "no-such-studio" }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });
});

describe("generateMetadata", () => {
  it("names the studio in the title and description, not a hardcoded 'Studio'", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: studio.slug }) });

    expect(metadata.title).toContain(studio.name);
    expect(metadata.title).not.toBe("Studio");
    expect(metadata.description).toContain(studio.name);
  });

  it("includes Open Graph type and a canonical URL", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: studio.slug }) });

    expect(metadata.openGraph?.title).toContain(studio.name);
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.alternates?.canonical).toContain(`/s/${studio.slug}`);
  });

  it("does not set the page to noindex", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: studio.slug }) });

    expect(metadata.robots).toBeUndefined();
  });
});
