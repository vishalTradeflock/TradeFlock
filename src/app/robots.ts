import type { MetadataRoute } from "next";
import { PRODUCTION_ORIGIN } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/studio/", "/api/"],
    },
    sitemap: "https://www.tradeflock.net/sitemap.xml",
    host: PRODUCTION_ORIGIN,
  };
}
