// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// Application-generated calendar token (unguessable secret, distinct from UUID primary keys).
// Used for per-member calendar subscriptions. A hex-encoded random 16-byte secret.
export function newCalendarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
