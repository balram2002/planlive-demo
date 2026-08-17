import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // ImageKit CDN, used only if NEXT_PUBLIC_IMAGEKIT_* env vars are set.
      { protocol: "https", hostname: "ik.imagekit.io" },
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
