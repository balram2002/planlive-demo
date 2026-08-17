"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/action-button";
import { useToast } from "@/components/toast";
import { ProductThumb } from "@/components/product-thumb";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LiveAddProduct } from "@/components/live-add-product";
import {
  addProductToStream,
  adjustStock,
  removeProductFromStream,
  setFeaturedProduct,
} from "@/app/backstage-92k4x7/actions";

type ConsoleProduct = {
  id: string;
  title: string;
  priceInPaise: number;
  availableStock: number;
  inStream: boolean;
  imageUrl: string | null;
};

type Stats = { orders: number; revenuePaise: number };

/**
 * Seller live console: manage the product queue (add/remove), pin the
 * featured product, adjust stock, and watch live sales stats — all without
 * leaving the stream. Every change broadcasts to viewers over the data
 * channel. Mutations update local state optimistically (this page has no
 * server-rendered props to revalidate into), backed by the same Server
 * Actions the rest of the seller studio uses.
 */
export function LiveConsole({ streamId }: { streamId: string }) {
  const [products, setProducts] = useState<ConsoleProduct[] | null>(null);
  const [featuredProductId, setFeaturedProductId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    const [allRes, streamRes] = await Promise.all([
      fetch("/api/products"),
      fetch(`/api/streams/${streamId}`),
    ]);
    if (!allRes.ok || !streamRes.ok) return;
    const all = await allRes.json();
    const streamData = await streamRes.json();
    const inStreamIds = new Set<string>(streamData.products.map((p: { id: string }) => p.id));
    setProducts(
      all.products.map((p: ConsoleProduct) => ({ ...p, inStream: inStreamIds.has(p.id) })),
    );
    setFeaturedProductId(streamData.stream.featuredProductId ?? null);
  }, [streamId]);

  useEffect(() => {
    (async () => {
      await loadProducts();
    })();
  }, [loadProducts]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/streams/${streamId}/stats`);
        if (!res.ok || cancelled) return;
        setStats(await res.json());
      } catch {
        // Transient — next tick retries.
      }
    }
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [streamId]);

  function withPending(key: string, fn: () => Promise<void>) {
    setPending((prev) => new Set(prev).add(key));
    fn().finally(() => {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  }

  function bump(productId: string, delta: 1 | -1) {
    setProducts((prev) =>
      prev
        ? prev.map((p) =>
            p.id === productId ? { ...p, availableStock: Math.max(0, p.availableStock + delta) } : p,
          )
        : prev,
    );
    const fd = new FormData();
    fd.set("streamId", streamId);
    fd.set("productId", productId);
    fd.set("delta", String(delta));
    withPending(`stock-${productId}`, () => adjustStock(fd));
  }

  function toggleFeatured(productId: string, currentlyFeatured: boolean) {
    setFeaturedProductId(currentlyFeatured ? null : productId);
    const fd = new FormData();
    fd.set("streamId", streamId);
    fd.set("productId", currentlyFeatured ? "" : productId);
    withPending(`feature-${productId}`, () => setFeaturedProduct(fd));
  }

  function remove(productId: string) {
    setProducts((prev) => (prev ? prev.filter((p) => p.id !== productId) : prev));
    if (featuredProductId === productId) setFeaturedProductId(null);
    const fd = new FormData();
    fd.set("streamId", streamId);
    fd.set("productId", productId);
    withPending(`remove-${productId}`, () => removeProductFromStream(fd));
  }

  async function addExisting(productId: string, title: string) {
    setPending((prev) => new Set(prev).add(`add-${productId}`));
    const fd = new FormData();
    fd.set("streamId", streamId);
    fd.set("productId", productId);
    const result = await addProductToStream({}, fd);
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(`add-${productId}`);
      return next;
    });
    if (result.error) {
      toast({ title: result.error, variant: "error" });
      return;
    }
    toast({ title: result.success ?? `${title} added.`, variant: "success" });
    await loadProducts();
  }

  if (!products) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  const inStream = products.filter((p) => p.inStream);
  const available = products.filter((p) => !p.inStream);

  return (
    <div className="space-y-5">
      {/* Live stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "Orders", value: stats ? String(stats.orders) : "—" },
          { label: "Revenue", value: stats ? formatPrice(stats.revenuePaise) : "—" },
        ].map((stat) => (
          <Card key={stat.label} className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-faint">{stat.label}</p>
            <span className="relative mt-0.5 inline-flex h-7 items-center justify-center overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={stat.value}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 480, damping: 32 }}
                  className="text-lg font-bold tabular-nums"
                >
                  {stat.value}
                </motion.span>
              </AnimatePresence>
            </span>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-faint">Quick add</h2>
        <p className="mb-3 text-xs text-muted">Create a product with a photo and drop it straight into the queue.</p>
        <LiveAddProduct streamId={streamId} variant="block" onAdded={loadProducts} />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
          In this stream ({inStream.length})
        </h2>
        {inStream.length === 0 ? (
          <p className="py-2 text-sm text-faint">No products in the stream — add one below.</p>
        ) : (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {inStream.map((product) => {
                const featured = product.id === featuredProductId;
                return (
                  <motion.li
                    key={product.id}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className={cn(
                      "rounded-2xl border p-3 transition-colors duration-300",
                      featured ? "border-primary/60 bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <ProductThumb src={product.imageUrl} alt={product.title} sizes="40px" className="w-10" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium">
                          {featured ? "★ " : ""}
                          {product.title}
                        </p>
                        <span className="shrink-0 text-sm text-muted">{formatPrice(product.priceInPaise)}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full border border-border bg-surface-2 px-1 py-0.5">
                        <button
                          type="button"
                          disabled={product.availableStock <= 0 || pending.has(`stock-${product.id}`)}
                          onClick={() => bump(product.id, -1)}
                          aria-label="Decrease stock"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-all active:scale-90 disabled:opacity-30"
                        >
                          −
                        </button>
                        <Badge tone={product.availableStock > 0 ? "success" : "warning"}>
                          {product.availableStock}
                        </Badge>
                        <button
                          type="button"
                          disabled={pending.has(`stock-${product.id}`)}
                          onClick={() => bump(product.id, 1)}
                          aria-label="Increase stock"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-all active:scale-90"
                        >
                          +
                        </button>
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleFeatured(product.id, featured)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                          featured ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
                        )}
                      >
                        {featured ? "Unpin" : "Feature"}
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(product.id)}
                        className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-live transition-all hover:bg-live/10 active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {available.length > 0 ? (
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Add to stream</h3>
            <ul className="space-y-1.5">
              {available.map((product) => (
                <li key={product.id} className="flex items-center gap-2.5">
                  <ProductThumb src={product.imageUrl} alt={product.title} sizes="32px" className="w-8" rounded="rounded-lg" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{product.title}</span>
                  <button
                    type="button"
                    disabled={pending.has(`add-${product.id}`)}
                    onClick={() => addExisting(product.id, product.title)}
                    className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium transition-all hover:bg-border active:scale-95 disabled:opacity-50"
                  >
                    {pending.has(`add-${product.id}`) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Spinner /> Adding
                      </span>
                    ) : (
                      "+ Add"
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
