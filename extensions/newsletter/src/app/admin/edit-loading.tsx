import { Footer, Header } from "../../components/Header";
import { EditorSkeleton } from "./Skeletons";

export default function EditLoading() {
  return (
    <>
      <Header current="admin" />
      <main id="main" className="wrap admin admin--editor" aria-busy="true">
        <EditorSkeleton />
      </main>
      <Footer />
    </>
  );
}
