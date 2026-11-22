import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // the app has two root layouts (the site and the newsletter), so the 404
    // page lives in src/app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default nextConfig;
