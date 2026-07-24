import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const SITE_URL = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/api/",
          "/booking/",
          "/my-bookings",
          "/login",
          "/verify-otp",
          "/logout",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
