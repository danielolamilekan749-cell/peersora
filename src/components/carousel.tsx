"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icon";

/**
 * Swipeable photo strip. On a phone you swipe left and right; on desktop the
 * arrows and the dots work too. Give it a size with className (for example an
 * aspect ratio). Slides snap into place, like a TikTok photo post.
 */
export function ImageCarousel({
  images,
  alt,
  className,
  sizes,
  href,
  priority = false,
}: {
  images: string[];
  alt: string;
  className?: string;
  sizes: string;
  href?: string;
  priority?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const many = images.length > 1;

  function onScroll() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(images.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  function go(target: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: Math.min(images.length - 1, Math.max(0, target)) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={cn("group relative overflow-hidden bg-canvas", className)}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="scrollbar-none absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {images.map((src, imageIndex) => {
          const picture = (
            <Image
              src={src}
              alt={many ? `${alt}, photo ${imageIndex + 1} of ${images.length}` : alt}
              fill
              sizes={sizes}
              draggable={false}
              priority={priority && imageIndex === 0}
              className="select-none object-cover"
            />
          );
          return (
            <div key={`${src}-${imageIndex}`} className="relative h-full w-full shrink-0 snap-center snap-always">
              {href ? (
                <Link href={href} className="absolute inset-0 block" draggable={false}>
                  {picture}
                </Link>
              ) : (
                picture
              )}
            </div>
          );
        })}
      </div>

      {many ? (
        <>
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {index + 1}/{images.length}
          </span>
          {index > 0 ? (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-card hover:bg-white lg:grid"
            >
              <Icon name="back" size={16} />
            </button>
          ) : null}
          {index < images.length - 1 ? (
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-card hover:bg-white lg:grid"
            >
              <Icon name="forward" size={16} />
            </button>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((src, imageIndex) => (
              <span
                key={`${src}-dot-${imageIndex}`}
                className={cn("h-1.5 rounded-full transition-all", imageIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/60")}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
