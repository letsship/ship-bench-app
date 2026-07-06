"use client";

import { formatDayLabel } from "@/lib/format";
import { PageHeader } from "../_components/ui";

interface Props {
  nowIso: string;
  timeZone: string;
}

// Render the heading on the client so the date rolls over at the visitor's
// midnight without waiting for a reload of the page.
export function TodayHeading({ nowIso, timeZone }: Props) {
  const subtitle = formatDayLabel(nowIso, timeZone);
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}
