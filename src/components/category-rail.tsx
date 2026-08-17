"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Spinner } from "@/components/ui/action-button";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/cn";

export type RailCategory = {
  id: string;
  name: string;
  imageUrl: string | null;
};

const ALL_KEY = "__all__";

/**
 * Image-first category carousel. Tapping a tile scrolls it to the
 * horizontal centre; same-route ?category= navigation carries its own
 * spinner via useTransition.
 */
export function CategoryRail({
  categories,
  selectedId,
  basePath,
}: {
  categories: RailCategory[];
  selectedId: string | null;
  basePath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetId, setTargetId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const scrollerRef = useRef<HTMLDivElement>(null);

  const centerTile = useCallback((key: string, behavior: ScrollBehavior) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const tile = scroller.querySelector<HTMLElement>(`[data-cat="${CSS.escape(key)}"]`);
    if (!tile) return;
    const target = tile.offsetLeft - scroller.clientWidth / 2 + tile.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior });
  }, []);

  useEffect(() => {
    centerTile(selectedId ?? ALL_KEY, "auto");
  }, [selectedId, centerTile]);

  function go(id: string | null) {
    haptics.tap();
    const key = id ?? ALL_KEY;
    setTargetId(key);
    centerTile(key, reduceMotion ? "auto" : "smooth");
    startTransition(() => {
      router.push(id ? `${basePath}?category=${id}` : basePath, { scroll: false });
    });
  }

  const pendingOn = (key: string) => isPending && targetId === key;

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-1 transition-opacity duration-200",
        isPending && "opacity-70",
      )}
      data-no-swipe
      aria-busy={isPending}
      role="tablist"
      aria-label="Browse categories"
    >
      <button
        data-cat={ALL_KEY}
        type="button"
        role="tab"
        aria-selected={!selectedId}
        onClick={() => go(null)}
        disabled={isPending}
        className={cn(
          "group relative flex aspect-[4/5] w-[104px] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-primary via-primary to-primary-hover p-2.5 text-left transition-all duration-300",
          !reduceMotion && "active:scale-[0.96]",
          !selectedId ? "border-foreground shadow-pop" : "border-transparent opacity-85 hover:opacity-100",
        )}
      >
        <span className="relative z-20 text-sm font-bold leading-tight text-white drop-shadow">For You</span>
        <span className="absolute bottom-2 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-white/20 text-2xl backdrop-blur-sm">
          {pendingOn(ALL_KEY) ? <Spinner className="h-5 w-5 text-white" /> : "⚡"}
        </span>
      </button>

      {categories.map((category) => {
        const active = selectedId === category.id;
        return (
          <button
            key={category.id}
            data-cat={category.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => go(category.id)}
            disabled={isPending}
            className={cn(
              "group relative flex aspect-[4/5] w-[104px] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border-2 bg-surface-2 p-2.5 text-left transition-all duration-300",
              !reduceMotion && "active:scale-[0.96]",
              active ? "border-primary shadow-pop" : "border-transparent hover:border-border",
            )}
          >
            {category.imageUrl ? (
              <>
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  sizes="104px"
                  className={cn(
                    "object-cover transition-transform duration-500",
                    !reduceMotion && "group-hover:scale-110",
                    active && !reduceMotion && "scale-105",
                  )}
                />
                <span className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/40" />
              </>
            ) : (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-4xl opacity-70">🗂️</span>
            )}

            <span
              className={cn(
                "absolute inset-x-2.5 top-2.5 z-20 text-sm font-bold leading-tight drop-shadow-md",
                category.imageUrl ? "text-white" : "text-foreground",
              )}
            >
              {category.name}
            </span>

            {active ? <span className="absolute inset-x-2.5 bottom-2.5 z-20 h-1 rounded-full bg-primary" /> : null}

            {pendingOn(category.id) ? (
              <span className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                <Spinner className="h-5 w-5 text-white" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
