import type { Metadata, Viewport } from "next";
import { JSON_LD, baseMetadata, socialCards } from "@/lib/site-metadata";
import { SITE_THEME_SCRIPT } from "@/components/landing/theme";
import "./globals.css";

// Root layout for the Interactive OS at /interactive. It is a separate root
// layout from the landing site, so the OS keeps its own full-screen app shell
// (no page scroll, hidden scrollbars, its own dark mode) without leaking any
// of it into the landing page.

const TITLE = "Interactive OS — Siddhant Gupta";
const DESCRIPTION =
  "Siddhant Gupta's portfolio as a macOS-style desktop in the browser: working apps, a terminal, and an AI-powered Siri.";

// App-shell viewport: without maximumScale, iOS Safari auto-zooms the page
// whenever an input under 16px gets focus (Messages composer, Notes link dialog,
// Spotlight…), breaking the full-screen desktop/iOS illusion. Pinch zoom
// still works — Safari ignores the cap for user gestures.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  ...baseMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/interactive" },
  ...socialCards(TITLE, DESCRIPTION, "/interactive"),
};

export default function OsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-site-theme (the landing site's light/dark choice) is set before
    // first paint by SITE_THEME_SCRIPT; the laptop page's background follows it.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SITE_THEME_SCRIPT }} />
      </head>
      <body className="h-full overflow-hidden bg-black">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
