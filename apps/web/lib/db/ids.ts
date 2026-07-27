// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// An opaque, URL-safe secret for a member's private calendar subscription
// link. Dashes are stripped so it drops cleanly into a path segment; the
// underlying UUIDv4 still carries 122 bits of randomness, so it is
// unguessable.
export function newCalendarToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
