import type { Metadata } from "next";
import { Footer, Header } from "../components/Header";
import { Profile } from "../components/Profile";

// /newsletter/profile — a signed-in reader's saved posts, likes and comments.

export const metadata: Metadata = { title: "Your profile", robots: { index: false, follow: false } };

export default function ProfilePage() {
  return (
    <>
      <Header />
      <main id="main" className="wrap profile">
        <Profile />
      </main>
      <Footer />
    </>
  );
}
