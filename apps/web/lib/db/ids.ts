// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// Long, unguessable URL-safe secret for a member's private calendar feed
// (/api/ical/[token]). Two dash-stripped UUIDs ≈ 256 bits of entropy.
export function newCalendarToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
}
