// A private per-member calendar subscription secret. Calendar apps can't send
// our session cookie, so this token in the URL is the only authorization for
// GET /api/ical/[token] — it must be long and unguessable, not a plain UUID.

const TOKEN_BYTES = 32;

export function newCalendarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
