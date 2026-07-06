import { formatDayLabel } from "@/lib/format";
import { PageHeader } from "../_components/ui";

// Rendered on the server using the studio's configured timezone, so the date
// matches the studio's wall clock rather than the server's or visitor's.
export function TodayHeading({ now, timeZone }: { now: string; timeZone: string }) {
  const subtitle = formatDayLabel(now, timeZone);
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}
