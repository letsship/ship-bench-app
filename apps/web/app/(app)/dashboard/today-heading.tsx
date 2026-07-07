import { PageHeader } from "../_components/ui";

// The header's date is sourced from the same server-computed instant the
// dashboard service uses for the class list, so the studio's wall-clock day
// is shown regardless of the visitor's machine timezone and the server-
// rendered HTML matches what the browser hydrates.
export function TodayHeading({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}
