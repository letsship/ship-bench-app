import { publicBaseUrl } from "@/lib/services/public-studio";

export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}