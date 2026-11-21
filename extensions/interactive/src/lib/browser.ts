"use client";

/**
 * Opens a URL in a real browser tab.
 *
 * This is the only outbound-link path in the OS. The in-app Safari renders
 * pages through a proxy, and every site we link to (GitHub, LinkedIn, X,
 * project demos) sends X-Frame-Options / CSP frame-ancestors — so routing a
 * link there showed an error instead of the page. A real tab is the honest hop.
 *
 * Safari still browses internally from its own address bar and from links
 * inside an already-proxied page; it just isn't a destination for links
 * elsewhere in the OS.
 */
export function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
