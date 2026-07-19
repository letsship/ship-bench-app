import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
