import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The single way a product image is rendered across the app: a square box
 * with `object-cover`, so uploads of any source ratio fill the frame without
 * distortion. Falls back to a neutral tag glyph when there's no image.
 */
export function ProductThumb({
  src,
  alt,
  sizes = "96px",
  className,
  rounded = "rounded-xl",
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  rounded?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("relative block aspect-square shrink-0 overflow-hidden bg-surface-2", rounded, className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-lg">🏷️</span>
      )}
    </span>
  );
}
