import type { Metadata } from "next";
import { Footer, Header } from "../../components/Header";
import AdminDashboard from "./dashboard";

export const metadata: Metadata = { title: "Manage", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <>
      <Header current="admin" />
      <AdminDashboard />
      <Footer />
    </>
  );
}
