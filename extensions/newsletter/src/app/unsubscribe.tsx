import type { Metadata } from "next";
import { Footer, Header } from "../components/Header";
import { TokenAction } from "../components/TokenAction";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <>
      <Header />
      <main id="main" className="wrap">
        <TokenAction token={token} action="unsubscribe" />
      </main>
      <Footer />
    </>
  );
}
