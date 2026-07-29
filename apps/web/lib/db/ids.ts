// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// An unguessable, URL-safe secret used as the per-member calendar subscription
// token at /api/ical/[token]. 16 random bytes (128 bits) hex-encoded → 32 chars.
// The token alone authorizes the feed (calendar clients can't send cookies), so
// it must be cryptographically random and unique per member. Generated app-side
// so both repository implementations mint identical tokens.
export function newCalendarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
