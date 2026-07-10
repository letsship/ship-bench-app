import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

// Wires up the instrumentation hook and source maps. Source-map upload is
// build-time only and needs SENTRY_AUTH_TOKEN; without one it's silently
// skipped, so `pnpm build` / the Cloudflare build stay green with no Sentry
// secrets configured.
export default withSentryConfig(config, {
  silent: true,
});
