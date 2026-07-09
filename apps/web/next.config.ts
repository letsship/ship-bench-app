import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Makes the `DB` D1 binding (and other Worker bindings from wrangler.jsonc)
// resolvable via getCloudflareContext() under `next dev`, the same way they're
// resolved in the deployed Worker. Skipped when USE_FAKE_BACKENDS=1 since that
// mode never touches the binding.
if (process.env.USE_FAKE_BACKENDS !== "1") {
  initOpenNextCloudflareForDev();
}

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

export default config;
