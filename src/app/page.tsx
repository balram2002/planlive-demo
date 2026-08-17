"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type StreamCard = {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  productCount: number;
};

export default function DiscoverPage() {
  const [streams, setStreams] = useState<StreamCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/streams");
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
  }, []);

  return (
    <main className="min-h-screen px-4 py-6 pb-16">
      <div className="mx-auto mb-6 max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
      </div>

      <div className="mx-auto max-w-lg">
        {streams === null ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton aspect-[3/4]" />
            <div className="skeleton aspect-[3/4]" />
          </div>
        ) : streams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <span className="mb-2 block text-3xl">📡</span>
            <p className="text-sm text-muted">
              No one is live right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {streams.map((s) => (
              <Link
                key={s.id}
                href={`/live/${s.id}`}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-black shadow-card transition-transform active:scale-[0.98]"
              >
                {s.thumbnailUrl ? (
                  <Image
                    src={s.thumbnailUrl}
                    alt={s.title ?? "Live stream"}
                    fill
                    sizes="200px"
                    className="object-cover opacity-90 transition-opacity group-active:opacity-70"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    🎥
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8">
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-live-pulse" />
                    Live
                  </span>
                  <p className="truncate text-xs font-medium text-white">
                    {s.title ?? "Live now"}
                  </p>
                  <p className="text-[10px] text-white/70">
                    {s.productCount} {s.productCount === 1 ? "product" : "products"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="mx-auto mt-10 max-w-lg text-center">
        <Link
          href="/backstage-92k4x7"
          className="text-xs font-medium text-faint transition-colors hover:text-muted"
        >
          Seller? Go live →
        </Link>
      </footer>
    </main>
  );
}
