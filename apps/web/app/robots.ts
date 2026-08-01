import type { MetadataRoute } from "next";
import { buildRobotsMetadata, siteBaseUrl } from "@/lib/seo/studio-seo";

export default function robots(): MetadataRoute.Robots {
  return buildRobotsMetadata(siteBaseUrl());
}
