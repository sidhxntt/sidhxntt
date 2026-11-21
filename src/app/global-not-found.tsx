import type { Metadata } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist/index.css";
import { THEME_SCRIPT } from "@/components/landing/theme";
import "./(site)/landing.css";

// The app has two root layouts (landing site and Interactive OS), so unmatched
// URLs need this standalone 404 page. It uses the landing site's styles.

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="site">
        <main className="wrap not-found">
          <p className="not-found__code">404</p>
          <h1 className="contact__title">This page doesn&rsquo;t exist.</h1>
          <p className="contact__intro">The link may be old, or the address may have a typo.</p>
          <div className="contact__actions">
            <a className="button button--primary" href="/">
              Go to the homepage
            </a>
            <a className="button" href="/interactive">
              Open the Interactive OS
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
