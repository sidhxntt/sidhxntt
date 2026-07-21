import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { GET } from "@/app/api/proxy/route";

// The SSRF guard (isBlocked/isPrivateIp/fetchValidated) is private to the
// route, so it's exercised through GET. DNS is mocked: no test touches the
// network, and blocked targets must fail *before* any fetch happens.

vi.mock("node:dns/promises", () => {
  const lookup = vi.fn();
  return { default: { lookup }, lookup };
});

const lookupMock = vi.mocked(lookup);
const PUBLIC_ADDR = [{ address: "93.184.216.34", family: 4 }];

const fetchMock = vi.fn<typeof fetch>();

const call = (url?: string) =>
  GET(
    new Request(
      url === undefined
        ? "http://test.host/api/proxy"
        : `http://test.host/api/proxy?url=${encodeURIComponent(url)}`,
    ),
  );

const htmlResponse = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "text/html", ...headers } });

const redirect = (location: string, status = 301) =>
  new Response(null, { status, headers: { location } });

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockResolvedValue(PUBLIC_ADDR as never);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxy input validation", () => {
  it("400s when url is missing", async () => {
    const res = await call();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing url" });
  });

  it("400s on an unparseable url", async () => {
    const res = await call("not a url");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad url" });
  });
});

describe("proxy SSRF guard — no DNS needed", () => {
  it.each([
    "ftp://example.com/file",
    "file:///etc/passwd",
    "http://localhost:3000/admin",
    "http://sub.localhost/",
    "http://myhost.local/",
    "http://service.internal/",
    "http://127.0.0.1/",
    "http://127.9.8.7/",
    "http://10.0.0.5/secrets",
    "http://192.168.1.1/router",
    "http://169.254.169.254/latest/meta-data", // cloud metadata endpoint
    "http://0.0.0.0/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://100.64.0.1/", // CGNAT
    "http://[::1]/",
    "http://[fe80::1]/", // link-local
    "http://[fd00::1]/", // unique-local
  ])("blocks %s without resolving or fetching", async (target) => {
    const res = await call(target);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "blocked url" });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://172.32.0.1/", // private range is only 172.16–31
    "http://100.128.0.1/", // CGNAT ends at 100.127
    "http://8.8.8.8/",
  ])("allows the public literal IP %s without a DNS lookup", async (target) => {
    fetchMock.mockResolvedValue(htmlResponse("<p>ok</p>"));
    const res = await call(target);
    expect(res.status).toBe(200);
    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("proxy SSRF guard — resolved addresses", () => {
  it("blocks a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as never);
    const res = await call("https://rebind.example.com/");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "blocked url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks when even one resolved address is private", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.10", family: 4 },
    ] as never);
    const res = await call("https://mixed.example.com/");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a hostname with no addresses", async () => {
    lookupMock.mockResolvedValue([] as never);
    const res = await call("https://empty.example.com/");
    expect(res.status).toBe(400);
  });

  it("blocks an unresolvable hostname", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    const res = await call("https://nope.example.com/");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "blocked url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a hostname resolving to public addresses only", async () => {
    fetchMock.mockResolvedValue(htmlResponse("<p>ok</p>"));
    const res = await call("https://example.com/");
    expect(res.status).toBe(200);
    expect(lookupMock).toHaveBeenCalledWith("example.com", expect.anything());
  });
});

describe("proxy HTML handling", () => {
  it("injects a <base> tag and strips meta CSP", async () => {
    fetchMock.mockResolvedValue(
      htmlResponse(
        "<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'\"><title>Hi</title></head><body>hello</body></html>",
      ),
    );
    const res = await call("https://example.com/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('<head><base href="https://example.com/">');
    expect(html).not.toMatch(/content-security-policy/i);
    expect(html).toContain("hello");
  });

  it("prepends the base tag when the page has no <head>", async () => {
    fetchMock.mockResolvedValue(htmlResponse("<p>bare</p>"));
    const res = await call("https://example.com/bare");
    const html = await res.text();
    expect(html.startsWith('<base href="https://example.com/bare">')).toBe(true);
    expect(html).toContain("<p>bare</p>");
  });

  it("HTML-escapes the base href", async () => {
    fetchMock.mockResolvedValue(htmlResponse("<p>q</p>"));
    const res = await call("https://example.com/?a=1&b=2");
    const html = await res.text();
    expect(html).toContain('<base href="https://example.com/?a=1&amp;b=2">');
  });

  it("passes non-HTML bytes through with the upstream content type", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    fetchMock.mockResolvedValue(new Response(bytes, { headers: { "content-type": "image/png" } }));
    const res = await call("https://example.com/pic.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });
});

describe("proxy redirects", () => {
  it("follows redirects, re-validating every hop, and bases URLs on the final hop", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("https://cdn.example.net/landing"))
      .mockResolvedValueOnce(htmlResponse("<html><head></head><body>final</body></html>"));

    const res = await call("https://example.com/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<base href="https://cdn.example.net/landing">');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.example.net/landing");
    // both hostnames were resolved
    expect(lookupMock).toHaveBeenCalledWith("example.com", expect.anything());
    expect(lookupMock).toHaveBeenCalledWith("cdn.example.net", expect.anything());
  });

  it("resolves relative redirect locations against the current hop", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("/moved", 302))
      .mockResolvedValueOnce(htmlResponse("<html><head></head>ok</html>"));

    const res = await call("https://example.com/start");
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.com/moved");
  });

  it("blocks a redirect that points at a private address", async () => {
    fetchMock.mockResolvedValueOnce(redirect("http://127.0.0.1/internal"));
    const res = await call("https://example.com/");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "blocked url" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // never fetched the private hop
  });

  it("gives up after too many redirects with a 502", async () => {
    fetchMock.mockImplementation(async () => redirect("https://example.com/loop"));
    const res = await call("https://example.com/");
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(6); // MAX_REDIRECTS(5) + 1
  });
});

describe("proxy failure handling", () => {
  it("rejects an oversized declared content-length with a 502", async () => {
    fetchMock.mockResolvedValue(
      htmlResponse("tiny", { "content-length": String(9 * 1024 * 1024) }),
    );
    const res = await call("https://example.com/huge");
    expect(res.status).toBe(502);
  });

  it("cuts off bodies that stream past the 8 MB cap", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 9) controller.enqueue(chunk);
        else controller.close();
      },
    });
    fetchMock.mockResolvedValue(new Response(stream, { headers: { "content-type": "text/html" } }));
    const res = await call("https://example.com/stream");
    expect(res.status).toBe(502);
  });

  it("returns a friendly 502 page naming the host when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await call("https://unreachable.example.com/");
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("unreachable.example.com");
  });
});
