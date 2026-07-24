import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  devIndicators: false,
  experimental: {
    serverActions: {
      // Must be >= the storage upload cap (lib/storage.ts MAX_BYTES = 10 MB),
      // plus headroom for multipart overhead, or 4-10 MB image uploads are
      // rejected by the framework before the action's friendly error can run.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
