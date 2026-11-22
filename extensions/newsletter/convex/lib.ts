import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// The one Google account that may write. Override with the ADMIN_EMAIL
// environment variable on the Convex deployment.
export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? "siddhantg2002@gmail.com").trim().toLowerCase();
}

// Google must have verified the address (auth.ts records that), so a Google
// account merely claiming the email is not enough.
export function isAdminUser(user: Doc<"users"> | null): boolean {
  return (
    !!user &&
    typeof user.email === "string" &&
    user.email.trim().toLowerCase() === adminEmail() &&
    typeof user.emailVerificationTime === "number"
  );
}

export async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId === null ? null : await ctx.db.get(userId);
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new ConvexError("Sign in with Google to do that.");
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!isAdminUser(user)) throw new ConvexError("Only the newsletter's author can do that.");
  return user!;
}

// Top-level slugs that would collide with the newsletter's own routes.
export const RESERVED_ROOT_SLUGS = new Set(["admin", "topic", "confirm", "unsubscribe", "profile"]);

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// About 220 words a minute, never less than one.
export function readingMinutes(html: string | undefined): number | undefined {
  if (!html) return undefined;
  const words = htmlToText(html).split(" ").filter(Boolean).length;
  return words === 0 ? undefined : Math.max(1, Math.round(words / 220));
}

// The slug path from the root to this entry, or null if it or any ancestor
// isn't published (then readers can't reach it).
export function publishedPath(
  post: Doc<"posts">,
  byId: Map<Id<"posts">, Doc<"posts">>,
): string[] | null {
  const path: string[] = [];
  const seen = new Set<Id<"posts">>();
  let node: Doc<"posts"> = post;
  for (;;) {
    if (node.status !== "published" || seen.has(node._id)) return null;
    seen.add(node._id);
    path.unshift(node.slug);
    if (!node.parentId) return path;
    const parent = byId.get(node.parentId);
    if (!parent) return null;
    node = parent;
  }
}
