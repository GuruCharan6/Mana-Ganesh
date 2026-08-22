/* eslint-disable @next/next/no-img-element */

export function OrgBrandMark({
  logoUrl,
  size = 40,
}: {
  logoUrl?: string | null;
  size?: number;
}) {
  const src = logoUrl || "/icons/icon-512.png";
  return (
    <img
      src={src}
      alt="Organization mark"
      width={size}
      height={size}
      className="rounded-full border border-line object-cover bg-surface"
      style={{ width: size, height: size }}
    />
  );
}
