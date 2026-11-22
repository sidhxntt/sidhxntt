import { Footer, Header } from "../../components/Header";
import { DashboardSkeleton } from "./Skeletons";

export default function AdminLoading() {
  return (
    <>
      <Header current="admin" />
      <main id="main" className="wrap admin" aria-busy="true">
        <DashboardSkeleton />
      </main>
      <Footer />
    </>
  );
}
