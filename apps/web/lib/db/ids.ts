// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// Per-member secret for the private calendar feed URL: 128 bits of
// cryptographic randomness rendered as 32 lowercase hex characters. URL-safe
// and unguessable — the token alone authorizes the feed, so it must not be
// derivable or enumerable.
export function newCalendarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
