// Grey placeholders in the shape of what's loading, so the page doesn't jump
// when it arrives.

export function Skeleton({
  width = "100%",
  height = "1rem",
  radius,
  className = "",
}: {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}) {
  return <span className={`skel ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/** Rows of a list or table while it loads. */
export function SkeletonRows({ rows = 6, height = "3.5rem" }: { rows?: number; height?: string }) {
  return (
    <div className="skel-rows" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius="12px" />
      ))}
    </div>
  );
}
