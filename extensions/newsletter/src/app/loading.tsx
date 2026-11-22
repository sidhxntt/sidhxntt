import { Footer, Header } from "../components/Header";
import { Skeleton } from "../components/Skeleton";

// Shown the moment a reader clicks through to a post, series or topic while
// the page itself loads.

export default function EntryLoading() {
  return (
    <>
      <Header />
      <main id="main" className="wrap" aria-busy="true">
        <div className="loading-article" role="status" aria-label="Loading">
          <Skeleton width="9rem" height="0.9rem" />
          <Skeleton width="85%" height="3.25rem" radius="10px" />
          <Skeleton width="60%" height="3.25rem" radius="10px" />
          <Skeleton width="14rem" height="0.9rem" />
          <Skeleton height="clamp(12rem, 40vw, 26rem)" radius="var(--radius)" className="loading-article__cover" />
          <div className="loading-article__text">
            {[100, 96, 99, 70, 0, 98, 94, 88].map((w, i) =>
              w ? <Skeleton key={i} width={`${w}%`} height="1.05rem" /> : <span key={i} />,
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
