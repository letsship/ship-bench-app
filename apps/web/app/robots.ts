import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
