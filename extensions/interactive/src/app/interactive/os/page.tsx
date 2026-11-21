import type { Metadata } from "next";
import { MacExperience } from "@os/components/MacExperience";

// The OS itself, loaded inside the laptop's screen on /interactive. Opened
// directly it still works (power button first), but it isn't a page to index.
export const metadata: Metadata = {
  title: "Interactive OS — Siddhant Gupta",
  robots: { index: false, follow: false },
  alternates: { canonical: "/interactive" },
};

export default function EmbeddedOsPage() {
  return <MacExperience embedded />;
}
