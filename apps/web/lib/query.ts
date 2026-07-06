// URLSearchParams decodes a literal "+" as a space (the application/x-www-
// form-urlencoded convention) — but "+00:00" is exactly the UTC-offset form
// our own CSV's `Starts` column emits, and some proxies in front of this
// worker already percent-decode "%2B" to "+" once before we see the request,
// so `searchParams.get()` would silently turn a copy-pasted "+00:00" bound
// into an invalid " 00:00" timestamp. Parse the raw query string instead:
// `decodeURIComponent` only resolves %XX escapes and leaves a literal "+"
// alone, so the offset survives either way.
export function rawSearchParam(search: string, name: string): string | undefined {
  const match = new RegExp(`[?&]${name}=([^&]*)`).exec(search);
  return match ? decodeURIComponent(match[1]) : undefined;
}
