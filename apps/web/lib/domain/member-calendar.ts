// Token generation and session-filtering helpers for per-member calendar feeds.
// Pure functions — no framework or database imports.

import type { Booking } from "@/lib/db/types";
import { isSeatTaking } from "./capacity";

export function newCalendarToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function seatTakenSessionIds(bookings: Booking[]): Set<string> {
  return new Set(bookings.filter((b) => isSeatTaking(b.status)).map((b) => b.sessionId));
}
