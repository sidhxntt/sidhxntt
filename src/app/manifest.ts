import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Siddhant Gupta — Portfolio OS",
    short_name: "Siddhant",
    description:
      "An interactive macOS-style portfolio by Siddhant Gupta — working apps, games, and an AI-powered Siri.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
