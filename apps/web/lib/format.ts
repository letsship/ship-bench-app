import { studioTodayLabel } from "@/lib/domain/dates";

// Display formatting for the UI, always in the studio's timezone so what an
// operator sees matches the studio's wall clock.

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatDayLabel(iso: string, timeZone: string): string {
  return studioTodayLabel(timeZone, new Date(iso));
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone }).format(new Date(iso));
}
