import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation } from "./_generated/server";
import { requireAdmin } from "./lib";

// Images go into Convex storage so posts never depend on where they were
// copied from.

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// After an upload: the public URL the editor puts in the post.
export const urlFor = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new ConvexError("That upload is missing.");
    return url;
  },
});

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// An image pasted from another site (Notion, Medium, a blog): fetch it from
// here, since the browser usually can't (CORS), and store a copy.
export const importFromUrl = action({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<{ storageId: string; url: string }> => {
    if (!(await ctx.runQuery(internal.users.isAdmin, {}))) {
      throw new ConvexError("Only the newsletter's author can do that.");
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ConvexError("That image address isn't valid.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new ConvexError("Only web images can be imported.");
    }
    const res = await fetch(parsed.toString(), { redirect: "follow" });
    if (!res.ok) throw new ConvexError(`The image couldn't be downloaded (${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new ConvexError("That link isn't an image.");
    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_BYTES) throw new ConvexError("That image is over 15 MB.");
    const storageId = await ctx.storage.store(blob);
    const stored = await ctx.storage.getUrl(storageId);
    if (!stored) throw new ConvexError("The image couldn't be stored.");
    return { storageId, url: stored };
  },
});
