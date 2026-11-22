import type { AgentConfig } from "./config";

// Talks to the newsletter's /agent/* endpoints (convex/http.ts).

export type Entry = {
  id: string;
  kind: "post" | "series" | "folder";
  title: string;
  slug: string;
  path: string;
  parent: string | null;
  status: "draft" | "published";
  live: boolean;
  order: number;
  topic: string | null;
  summary: string | null;
  coverUrl: string | null;
  readingMinutes: number | null;
  publishedAt: number | null;
  updatedAt: number;
  emailedAt: number | null;
  likes: number;
  comments: number;
  views: number;
  reads: number;
};

export type Ref = { id?: string; path?: string };

export class AgentClient {
  /** The site this deployment belongs to, from its SITE_URL; known after the first call. */
  site: string | undefined;

  constructor(readonly config: AgentConfig) {}

  async call<T>(op: string, body: unknown = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.config.siteUrl}/agent/${op}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${this.config.siteUrl}: ${e instanceof Error ? e.message : e}`);
    }
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; site?: string; error?: string } | null;
    if (json?.site) this.site = json.site.replace(/\/+$/, "");
    if (!res.ok || !json?.ok) {
      const hint =
        res.status === 404 && !json
          ? " (is the newsletter's Convex code deployed? Run `npx convex dev` or `npx convex deploy`)"
          : "";
      throw new Error(json?.error ?? `The newsletter answered ${res.status}${hint}.`);
    }
    return json.data as T;
  }

  async upload(bytes: Uint8Array, type: string): Promise<{ storageId: string; url: string }> {
    const res = await fetch(`${this.config.siteUrl}/agent/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.key}`, "Content-Type": type },
      body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type }),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { storageId: string; url: string };
      error?: string;
    } | null;
    if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? `Upload failed (${res.status}).`);
    return json.data;
  }

  /** Where readers (or, for drafts, the author in the admin) open it. */
  linkFor(entry: Pick<Entry, "id" | "path" | "live">): string {
    const base = this.config.publicUrl ?? this.site ?? "https://sidhxntt.dev";
    return entry.live ? `${base}/newsletter/${entry.path}` : `${base}/newsletter/admin/edit/${entry.id}`;
  }
}
