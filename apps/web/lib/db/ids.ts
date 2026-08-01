// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// Secret per-member calendar token: 122 bits of randomness, dash-stripped so
// the value is a single opaque URL segment. Distinct from newId() so call
// sites read as "mint a secret", not "mint a primary key".
export function newCalendarToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
