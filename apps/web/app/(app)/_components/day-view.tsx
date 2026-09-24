import React, { type ReactNode } from "react";
import { EmptyState } from "./ui";

export const DAY_VIEW_EMPTY_MESSAGE = "Nothing scheduled for this day";

export function DayView({ hasEntries, children }: { hasEntries: boolean; children: ReactNode }) {
  return hasEntries ? children : <EmptyState>{DAY_VIEW_EMPTY_MESSAGE}</EmptyState>;
}
