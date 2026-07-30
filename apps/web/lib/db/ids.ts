// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// High-entropy, URL-safe token authorizing a member's private calendar feed.
// calendar subscription URLs are bearer-style secrets (the URL *is* the auth),
// so a fresh UUID v4 is sufficient entropy and survives copy-paste into Apple
// / Google Calendar without escaping.
export function newIcalToken(): string {
  return crypto.randomUUID();
}
