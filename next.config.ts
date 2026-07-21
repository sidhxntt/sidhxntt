import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // input/doc/*.md are read at request time as the hand-written half of the
  // Siri and Messages system prompts — make sure they're traced into the
  // serverless bundles (fs reads via process.cwd() aren't statically traced).
  outputFileTracingIncludes: {
    "/api/siri": ["./input/doc/**/*"],
    "/api/messages": ["./input/doc/**/*"],
  },
};

export default nextConfig;
