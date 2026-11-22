import { Skeleton, SkeletonRows } from "../../components/Skeleton";

// Placeholders in the shape of the admin pages, for the moment between a
// click and the page (or the sign-in check) being ready.

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="admin__head">
        <Skeleton width="13rem" height="2.75rem" radius="10px" />
        <div className="side-actions">
          <Skeleton width="11rem" height="2.75rem" radius="10px" />
          <Skeleton width="7rem" height="2.75rem" radius="10px" />
        </div>
      </div>
      <div className="skel-tabs">
        {[5, 6, 7, 8].map((w) => (
          <Skeleton key={w} width={`${w}rem`} height="1.1rem" />
        ))}
      </div>
      <SkeletonRows rows={7} />
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="ed-bar">
        <Skeleton width="16rem" height="1.6rem" />
        <Skeleton width="14rem" height="2rem" radius="10px" />
      </div>
      <div className="ed-layout">
        <div className="ed-canvas loading-article">
          <Skeleton width="11rem" height="2.5rem" radius="10px" />
          <Skeleton width="80%" height="3.4rem" radius="10px" />
          <Skeleton width="55%" height="1.4rem" />
          <Skeleton height="3rem" radius="12px" />
          <div className="loading-article__text">
            {[100, 95, 98, 72].map((w) => (
              <Skeleton key={w} width={`${w}%`} height="1.05rem" />
            ))}
          </div>
        </div>
        <div className="ed-side">
          <Skeleton height="22rem" radius="14px" />
        </div>
      </div>
    </div>
  );
}
