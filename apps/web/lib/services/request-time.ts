import { cache } from "react";

// A single, per-request canonical "now". Server Components that need the
// current instant during one render pass share this value instead of each
// calling `new Date()` independently — independent reads can drift across the
// multiple internal render passes Next.js performs for a streamed dynamic
// request, which is the root cause of the dashboard's hydration mismatch and
// date-flip near studio-timezone midnight. `cache()` scopes the memoization to
// the current request.
export const getRequestNowIso = cache((): string => new Date().toISOString());
