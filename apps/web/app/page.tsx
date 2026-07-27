import Link from "next/link";

const FEATURES = [
  {
    title: "Fill every class",
    body: "Live occupancy and automatic waitlists mean a freed-up spot never goes to waste.",
  },
  {
    title: "Members who stick",
    body: "One tidy record per member — bookings, credits, and history in a single place.",
  },
  {
    title: "Invoicing that adds up",
    body: "Line items, tax, and refunds computed for you, then sent the moment an invoice is issued.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav className="flex items-center justify-between">
        <span className="text-lg font-semibold">Studiobook</span>
        <Link href="/login" className="sb-btn sb-btn-primary">
          Sign in
        </Link>
      </nav>

      <section className="mt-20 max-w-2xl">
        <span className="sb-badge sb-badge-clay">For movement studios</span>
        <h1 className="mt-5 text-5xl leading-tight">Run your studio, not a spreadsheet.</h1>
        <p className="mt-5 text-lg text-[var(--color-muted)]">
          Studiobook keeps your pottery wheels spinning and your yoga mats full — bookings, members,
          and invoices in one calm workspace.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/login" className="sb-btn sb-btn-primary">
            Open the studio
          </Link>
          <Link href="/api/ical" className="sb-btn">
            Preview the schedule feed
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-6 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="sb-card p-6">
            <h2 className="text-xl">{feature.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{feature.body}</p>
          </article>
        ))}
      </section>

      <footer className="mt-24 border-t border-[var(--color-line)] pt-8 text-sm text-[var(--color-muted)]">
        Studiobook — a demonstration studio-management app.
      </footer>
    </main>
  );
}
