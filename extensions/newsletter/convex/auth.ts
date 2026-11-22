import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

// Everyone signs in with Google: readers to like and comment, Siddhant to
// write (lib.ts decides who counts as the admin).
//
// The profile keeps Google's own word on whether the email is verified, so a
// user's emailVerificationTime is only set for addresses Google has verified.
// The admin check requires it.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified === true,
        };
      },
    }),
  ],
});
