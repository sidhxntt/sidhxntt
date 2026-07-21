import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";

// Fetches external pages server-side so the in-OS Safari can render sites
// that send X-Frame-Options/CSP (we control the response headers here).
// SSRF-guarded: http(s) only, private hosts/IPs blocked by *resolved address*
// (not just the hostname string), and redirects are re-validated hop by hop.

const MAX_REDIRECTS = 5;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB response ceiling

/** True for loopback, link-local, RFC1918, CGNAT, unspecified and mapped forms. */
function isPrivateIp(ip: string): boolean {
  // normalize IPv4-mapped IPv6 — dotted (::ffff:127.0.0.1) AND the hex form
  // WHATWG URL serializes it to (::ffff:7f00:1)
  let v4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? ip;
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    v4 = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || // unique-local fc00::/7
    lower.startsWith("fd")
  );
}

/**
 * Rejects non-http schemes and any host that *resolves* to a private address —
 * catches decimal/octal/hex IP encodings and DNS names pointing inside.
 */
async function isBlocked(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (isIP(host)) return isPrivateIp(host);
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    return addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return true; // unresolvable → don't fetch it
  }
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Follows redirects manually so every hop passes the same SSRF check. */
async function fetchValidated(start: URL): Promise<{ res: Response; finalUrl: URL }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (await isBlocked(current)) throw new Error("blocked");
    const res = await fetch(current.toString(), {
      headers: BROWSER_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { res, finalUrl: current };
      current = new URL(loc, current); // relative redirects resolve against the hop
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error("too many redirects");
}

/** Reads at most MAX_BYTES; anything larger is cut off. */
async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("too large");
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      reader.cancel().catch(() => {});
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Injected into proxied HTML: keeps navigation *inside* the proxy. Without it,
// clicking a result or submitting a search form resolves against <base href>
// and the iframe hits the real site directly — which then blocks with
// X-Frame-Options. Runs fine in the sandboxed (opaque-origin) frame.
// Forms are proxied as GET regardless of their declared method: a real POST
// can't survive this sandbox anyway (it would hit the site directly and be
// frame-blocked), and the search forms we care about (DuckDuckGo html is
// method=POST) accept the same fields as query params.
const NAV_INTERCEPTOR = `<script>(function(){
var self=new URL(location.href);
function prox(u){try{var abs=new URL(u,document.baseURI);if(abs.protocol!=="http:"&&abs.protocol!=="https:")return null;return self.origin+self.pathname+"?url="+encodeURIComponent(abs.href)}catch(e){return null}}
document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var href=a.getAttribute("href");if(!href||href[0]==="#")return;var t=prox(href);if(t){e.preventDefault();e.stopPropagation();location.href=t}},true);
document.addEventListener("submit",function(e){var f=e.target;if(!f||f.tagName!=="FORM")return;var action;try{action=new URL(f.getAttribute("action")||document.baseURI,document.baseURI)}catch(err){return}
var qs=new URLSearchParams(action.search);new FormData(f).forEach(function(v,k){if(typeof v==="string")qs.set(k,v)});action.search=qs.toString();var t=prox(action.href);if(t){e.preventDefault();e.stopPropagation();location.href=t}},true);
})()</script>`;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }

  // Google search requires JS + cookies, which the sandboxed frame can't
  // provide (and Google retired its basic-HTML mode) — serve the same query
  // through DuckDuckGo's HTML endpoint instead, which is built for this.
  // Only the homepage and /search: other Google properties still pass through.
  if (/(^|\.)google\.[a-z.]+$/.test(target.hostname) && (target.pathname === "/" || target.pathname === "/search")) {
    const q = target.searchParams.get("q");
    target = new URL(q ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` : "https://html.duckduckgo.com/html/");
  }

  // DDG result links point at a /l/?uddg=<real url> redirect page whose script
  // tries to navigate the top window — the sandbox blocks that, stranding the
  // frame on a blank interstitial. Unwrap it server-side and go straight to
  // the destination.
  if (/(^|\.)duckduckgo\.com$/.test(target.hostname) && target.pathname === "/l/") {
    const uddg = target.searchParams.get("uddg");
    if (uddg) {
      try {
        target = new URL(uddg);
      } catch {
        /* keep the original target; the generic error page handles it */
      }
    }
  }

  try {
    const { res: upstream, finalUrl } = await fetchValidated(target);
    const contentType = upstream.headers.get("content-type") ?? "text/html";
    const body = await readCapped(upstream);

    if (contentType.includes("text/html")) {
      let html = new TextDecoder().decode(body);
      // resolve relative asset/link URLs against the original site
      const baseTag = `<base href="${escapeAttr(finalUrl.toString())}">${NAV_INTERCEPTOR}`;
      // strip meta CSP that could blank the page inside our frame
      html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
      html = html.includes("<head>") ? html.replace("<head>", `<head>${baseTag}`) : baseTag + html;
      return new NextResponse(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    // non-HTML (images, css fetched directly, pdfs…): pass bytes through
    return new NextResponse(Buffer.from(body), {
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch (e) {
    const blocked = e instanceof Error && e.message === "blocked";
    if (blocked) return NextResponse.json({ error: "blocked url" }, { status: 400 });
    return new NextResponse(
      `<!doctype html><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;color:#666"><div style="text-align:center"><p style="font-size:40px">🌐</p><p><b>${escapeAttr(target.hostname)}</b> couldn't be reached.</p></div></body>`,
      { headers: { "content-type": "text/html" }, status: 502 },
    );
  }
}
