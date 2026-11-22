import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost:3000/" },
    },
    globals: true,
    include: [
      "src/**/*.test.{ts,tsx}",
      "extensions/newsletter/**/*.test.{ts,tsx}",
    ],
    // convex-test runs the newsletter's Convex functions in-process
    server: { deps: { inline: ["convex-test"] } },
    coverage: { provider: "v8" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@nl": fileURLToPath(new URL("./extensions/newsletter/src", import.meta.url)),
      "@nl-convex": fileURLToPath(new URL("./extensions/newsletter/convex", import.meta.url)),
    },
  },
});
