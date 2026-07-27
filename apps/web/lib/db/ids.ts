// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// An unguessable, URL-safe secret for a member's private calendar feed. Derived
// from a random UUID (122 bits of entropy) with the dashes stripped so it drops
// cleanly into a subscription URL. Generated app-side for the same reason ids
// are: both repository implementations insert a fully-formed row.
export function newCalendarToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
