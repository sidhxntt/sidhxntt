import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist/index.css";
import { profile } from "@/data/portfolio";
import { JSON_LD, SITE_DESCRIPTION, baseMetadata, socialCards } from "@/lib/site-metadata";
import { THEME_SCRIPT } from "@/components/landing/theme";
import "./landing.css";

// Root layout for the landing site at /. Separate from the Interactive OS's
// root layout, so the two never share styles, scroll behaviour or theme state.

const TITLE = `${profile.name} — ${profile.role}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f6fb",
};

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: TITLE, template: `%s — ${profile.name}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  ...socialCards(TITLE, SITE_DESCRIPTION, "/"),
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set before first paint by THEME_SCRIPT; suppress the
    // hydration warning that the server-rendered attribute would differ.
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="site">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
      </body>
    </html>
  );
}
