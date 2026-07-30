// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// A member's private calendar-subscription secret. The token is the ONLY thing
// authorising /api/ical/:token (calendar apps cannot send a session cookie), so
// it must be long and unguessable: 24 CSPRNG bytes rendered as URL-safe hex.
export function newCalendarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
