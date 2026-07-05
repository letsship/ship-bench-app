"use client";

import { PageHeader } from "../_components/ui";

// Render the heading on the client so the date rolls over at the visitor's
// midnight without waiting for a reload of the page.
export function TodayHeading() {
  const subtitle = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}
