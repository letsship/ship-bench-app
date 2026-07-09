import { PageHeader } from "../_components/ui";

// The date is computed once on the server from the studio's configured
// timezone (see getDashboard) and passed in, so the server-rendered HTML and
// the client hydration always agree, and the date reflects the studio's
// wall clock rather than the visitor's or server host's local timezone.
export function TodayHeading({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}
