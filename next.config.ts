import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // the app has two root layouts (landing site + Interactive OS), so the
    // 404 page lives in src/app/global-not-found.tsx. The OS's code lives in
    // extensions/interactive (alias @os/*); src/app only holds thin route files.
    globalNotFound: true,
  },
  // input/doc/*.md are read at request time as the hand-written half of the
  // Siri and Messages system prompts — make sure they're traced into the
  // serverless bundles (fs reads via process.cwd() aren't statically traced).
  outputFileTracingIncludes: {
    "/api/siri": ["./input/doc/**/*"],
    "/api/messages": ["./input/doc/**/*"],
  },
  async rewrites() {
    return {
      // the Game OS is a static build in public/game (scripts/build-game.mjs);
      // serve its entry page at /game itself
      beforeFiles: [{ source: "/game", destination: "/game/index.html" }],
    };
  },
};

export default nextConfig;
