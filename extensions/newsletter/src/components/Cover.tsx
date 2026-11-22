/* eslint-disable @next/next/no-img-element -- covers live in Convex storage */

// A post's cover image, or a typographic stand-in in the brand's ink.
export function Cover({
  url,
  title,
  tag,
  className = "",
  eager = false,
}: {
  url: string | null;
  title: string;
  tag?: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <span className={`cover ${url ? "" : "cover--blank"} ${className}`}>
      {tag && <span className="tag">{tag}</span>}
      {url ? (
        <img src={url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span aria-hidden="true">{title}</span>
      )}
    </span>
  );
}
