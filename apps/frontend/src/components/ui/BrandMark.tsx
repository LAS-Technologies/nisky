import Image from "next/image";

export function BrandMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-[12px] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        alt=""
        className="absolute max-w-none"
        height={Math.round(size * 1.375)}
        src="/nisky-otter-approved.png"
        style={{ left: -size * 0.1875, top: -size * 0.1875 }}
        width={Math.round(size * 1.375)}
      />
    </span>
  );
}
