import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000";

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
