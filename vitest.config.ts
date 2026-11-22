import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost:3000/" },
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "extensions/interactive/src/**/*.test.{ts,tsx}",
      "extensions/newsletter/**/*.test.{ts,tsx}",
    ],
    // convex-test runs the newsletter's Convex functions in-process
    server: { deps: { inline: ["convex-test"] } },
    coverage: {
      provider: "v8",
      include: [
        "extensions/interactive/src/lib/**/*.ts",
        "extensions/interactive/src/components/apps/app-meta.ts",
        "extensions/interactive/src/api/proxy/**",
      ],
      exclude: [
        "extensions/interactive/src/lib/spotify-server.ts",
        "extensions/interactive/src/lib/useIsMobile.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@os": fileURLToPath(new URL("./extensions/interactive/src", import.meta.url)),
      "@nl": fileURLToPath(new URL("./extensions/newsletter/src", import.meta.url)),
      "@nl-convex": fileURLToPath(new URL("./extensions/newsletter/convex", import.meta.url)),
    },
  },
});
