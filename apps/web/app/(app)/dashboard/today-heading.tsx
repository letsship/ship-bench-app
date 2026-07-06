import { PageHeader } from "../_components/ui";

// Renders the dashboard header. The subtitle (the studio-local "today" label)
// is computed once on the server from a single shared `nowIso` instant in the
// studio's configured timezone, so the server-rendered HTML matches what the
// browser shows after load (no client re-render, no hydration mismatch, and
// the visitor's machine timezone never affects the displayed day).
export function TodayHeading({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}
