import { initials } from "../lib/format";

export function Avatar({ name, image, size = 28 }: { name: string; image: string | null; size?: number }) {
  if (image) {
    return (
      // Google profile photos; next/image would need their hosts configured
      // eslint-disable-next-line @next/next/no-img-element
      <img className="avatar" src={image} alt="" width={size} height={size} referrerPolicy="no-referrer" />
    );
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
