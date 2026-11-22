import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { currentUser, isAdminUser } from "./lib";

// Who is signed in, as the pages need it.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      id: user._id,
      name: user.name ?? user.email ?? "Reader",
      email: user.email ?? null,
      image: user.image ?? null,
      isAdmin: isAdminUser(user),
    };
  },
});

// For actions, which can't read the database themselves.
export const isAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId !== null && isAdminUser(await ctx.db.get(userId));
  },
});

export const adminEmailFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.email ?? null,
});
