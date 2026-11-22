import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist/index.css";
import { THEME_SCRIPT } from "@/components/landing/theme";
import { baseMetadata, socialCards } from "@/lib/site-metadata";
import { Providers } from "../components/Providers";
import { DESCRIPTION, TITLE } from "../lib/meta";
import "./newsletter.css";

// Root layout for the newsletter at /newsletter: the landing site's look and
// light/dark choice, plus Convex (live data and Google sign-in).


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef1f7",
};

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: TITLE, template: `%s — ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: "/newsletter" },
  ...socialCards(TITLE, DESCRIPTION, "/newsletter"),
};

export default function NewsletterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="nl">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
