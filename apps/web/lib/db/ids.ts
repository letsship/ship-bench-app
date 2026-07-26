// Application-generated UUID primary keys, matching the Postgres `uuid` columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// Supabase and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

// A secret, unguessable per-member calendar subscription token (CSPRNG, 256
// bits — Web Crypto so it works on both Node and the Cloudflare Workers
// runtime). This is the SOLE authorization for GET /api/ical/[token], so it
// must never be predictable.
export function newCalendarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
