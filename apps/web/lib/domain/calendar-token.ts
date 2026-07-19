// Generate a high-entropy URL-safe secret for per-member calendar subscriptions.
// Unguessable so a made-up token cannot collide.

export function generateCalendarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Convert to hex (64 chars for 32 bytes)
  let token = "";
  for (const byte of bytes) {
    token += byte.toString(16).padStart(2, "0");
  }
  return token;
}
