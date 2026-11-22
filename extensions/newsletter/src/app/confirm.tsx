import type { Metadata } from "next";
import { Footer, Header } from "../components/Header";
import { TokenAction } from "../components/TokenAction";

export const metadata: Metadata = { title: "Confirm your subscription", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <>
      <Header />
      <main id="main" className="wrap">
        <TokenAction token={token} action="confirm" />
      </main>
      <Footer />
    </>
  );
}
