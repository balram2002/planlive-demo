"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CategoryRail, type RailCategory } from "@/components/category-rail";
import { StreamCard, type DiscoverStream } from "@/components/stream-card";
import { EmptyState } from "@/components/ui/empty-state";

/** The buyer-facing live directory: category rail + auto-refreshing live-stream grid. */
export function DiscoverExperience({ basePath }: { basePath: string }) {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("category");

  const [categories, setCategories] = useState<RailCategory[] | null>(null);
  const [streams, setStreams] = useState<DiscoverStream[] | null>(null);

  // Show the loading skeleton immediately when the category filter changes,
  // rather than leaving the previous grid up until the new fetch resolves.
  const [lastCategoryId, setLastCategoryId] = useState(categoryId);
  if (categoryId !== lastCategoryId) {
    setLastCategoryId(categoryId);
    setStreams(null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/categories");
        if (!res.ok || cancelled) return;
        const body = await res.json();
        setCategories(body.categories);
      } catch {
        // retry not critical — the rail just stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const qs = categoryId ? `?category=${categoryId}` : "";
        const res = await fetch(`/api/streams${qs}`);
        if (!res.ok || cancelled) return;
        const body = await res.json();
        setStreams(body.streams);
      } catch {
        // retry on next tick
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [categoryId]);

  const selected = categoryId ? (categories?.find((c) => c.id === categoryId) ?? null) : null;

  return (
    <div className="space-y-4">
      {categories && categories.length > 0 ? (
        <CategoryRail categories={categories} selectedId={categoryId} basePath={basePath} />
      ) : null}

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{selected ? selected.name : "Live now"}</h2>
        <span className="text-xs text-faint">
          {streams === null ? "" : `${streams.length} ${streams.length === 1 ? "stream" : "streams"}`}
        </span>
      </div>

      {streams === null ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton aspect-[3/4] rounded-2xl" />
          <div className="skeleton aspect-[3/4] rounded-2xl" />
        </div>
      ) : streams.length === 0 ? (
        <EmptyState
          icon="📡"
          title={selected ? `Nobody is live in ${selected.name}` : "No live streams right now"}
          description="Check back soon — when sellers go live they'll show up here."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {streams.map((stream, i) => (
            <div key={stream.id} className="animate-item-in" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <StreamCard stream={stream} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
