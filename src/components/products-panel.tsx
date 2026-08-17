"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/format";
import type { ViewerProduct } from "./viewer-room";

export function ProductsPanel({
  open,
  onClose,
  products,
  onBuy,
}: {
  open: boolean;
  onClose: () => void;
  products: ViewerProduct[];
  onBuy: (product: ViewerProduct) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        aria-label="Close products"
        className="absolute inset-0 z-40 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Products"
        className="absolute inset-x-0 bottom-0 z-50 max-h-[75%] overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-pop"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-3 text-base font-semibold">
          Shop this stream ({products.length})
        </h2>

        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No products featured yet.
          </p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5"
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.title} fill sizes="56px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="text-xs text-muted">
                    {formatPrice(p.priceInPaise)} ·{" "}
                    {p.availableStock > 0 ? `${p.availableStock} left` : "Sold out"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={p.availableStock <= 0}
                  onClick={() => onBuy(p)}
                  className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-all active:scale-95 disabled:bg-surface-2 disabled:text-faint"
                >
                  {p.availableStock <= 0 ? "Sold out" : "Buy Now"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
