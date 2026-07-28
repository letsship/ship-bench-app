// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// Secret per-member calendar subscription token. Appears unauthenticated in
// the /api/ical/[token] URL, so it must be hard to guess — a random UUID is
// the same strength as our primary keys.
export function newCalendarToken(): string {
  return crypto.randomUUID();
}
