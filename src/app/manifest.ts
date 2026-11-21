import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Siddhant Gupta — Portfolio",
    short_name: "Siddhant",
    description:
      "Siddhant Gupta's portfolio — also explorable as a macOS-style Interactive OS and a 3D Game OS.",
    start_url: "/",
    display: "standalone",
    background_color: "#03050c",
    theme_color: "#03050c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
