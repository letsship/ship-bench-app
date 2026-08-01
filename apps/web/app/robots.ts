import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobots(publicBaseUrl());
}
