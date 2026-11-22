import type { Metadata } from "next";
import { Footer, Header } from "../../components/Header";
import AdminEdit from "./edit";

export const metadata: Metadata = { title: "Edit", robots: { index: false, follow: false } };

export default async function AdminEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parent?: string }>;
}) {
  const [{ id }, { parent }] = await Promise.all([params, searchParams]);
  return (
    <>
      <Header current="admin" />
      <AdminEdit id={id} parent={parent} />
      <Footer />
    </>
  );
}
