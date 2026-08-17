"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BroadcasterRoom } from "./broadcaster-room";
import { ImageUploader } from "./image-uploader";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "livewab_demo_broadcast";

type Product = {
  id: string;
  title: string;
  priceInPaise: number;
  availableStock: number;
  imageUrl: string | null;
};

type Phase =
  | { kind: "loading" }
  | { kind: "setup" }
  | { kind: "blocked" } // someone else's stream is live, we hold no secret for it
  | { kind: "live"; streamId: string; secret: string; startedAt: string };

function loadStoredBroadcast(): { streamId: string; secret: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.streamId === "string" && typeof parsed?.secret === "string") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function SellerStudio() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [streamTitle, setStreamTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-product form state.
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("1");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadProducts() {
    const res = await fetch("/api/products");
    const body = await res.json();
    setProducts(body.products ?? []);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/stream/active");
      const body = await res.json();
      if (body.stream) {
        const stored = loadStoredBroadcast();
        if (stored && stored.streamId === body.stream.id) {
          setPhase({
            kind: "live",
            streamId: body.stream.id,
            secret: stored.secret,
            startedAt: body.stream.startedAt,
          });
          return;
        }
        setPhase({ kind: "blocked" });
        return;
      }
      await loadProducts();
      setPhase({ kind: "setup" });
    })();
  }, []);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceRupees = Number(newPrice);
    const stock = Number(newStock);
    if (newTitle.trim().length < 2) {
      setError("Enter a product title.");
      return;
    }
    if (!Number.isFinite(priceRupees) || priceRupees < 1) {
      setError("Enter a valid price.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Enter a valid stock count.");
      return;
    }
    if (!newImage) {
      setError("Add a product photo.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          priceInPaise: Math.round(priceRupees * 100),
          availableStock: stock,
          imageUrl: newImage,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't add product.");
        return;
      }
      setProducts((prev) => [body.product, ...(prev ?? [])]);
      setSelected((prev) => new Set(prev).add(body.product.id));
      setNewTitle("");
      setNewPrice("");
      setNewStock("1");
      setNewImage(null);
    } finally {
      setCreating(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function goLive() {
    setError(null);
    if (selected.size === 0) {
      setError("Pick at least one product to feature.");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/stream/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: [...selected],
          title: streamTitle,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't start the stream.");
        return;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ streamId: body.streamId, secret: body.broadcastSecret }),
      );
      setPhase({
        kind: "live",
        streamId: body.streamId,
        secret: body.broadcastSecret,
        startedAt: new Date().toISOString(),
      });
    } finally {
      setStarting(false);
    }
  }

  async function endStream() {
    if (phase.kind !== "live") return;
    setEnding(true);
    try {
      await fetch("/api/stream/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId: phase.streamId,
          broadcastSecret: phase.secret,
        }),
      });
      localStorage.removeItem(STORAGE_KEY);
      setSelected(new Set());
      setStreamTitle("");
      await loadProducts();
      setPhase({ kind: "setup" });
    } finally {
      setEnding(false);
    }
  }

  if (phase.kind === "loading") {
    return <div className="skeleton mx-auto h-96 max-w-lg" />;
  }

  if (phase.kind === "blocked") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          A stream is already live from another browser/session. End it there
          first, or wait for it to finish.
        </p>
      </div>
    );
  }

  if (phase.kind === "live") {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">You&apos;re live</h1>
        <p className="mb-4 text-sm text-muted">
          Buyers can find your stream on Discover.
        </p>
        <BroadcasterRoom
          streamId={phase.streamId}
          broadcastSecret={phase.secret}
          startedAt={phase.startedAt}
        />
        <button
          type="button"
          disabled={ending}
          onClick={endStream}
          className="mt-4 w-full rounded-full bg-live py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {ending ? "Ending…" : "End stream"}
        </button>
      </div>
    );
  }

  // ---- setup phase ----
  return (
    <div className="animate-page-in mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Go live</h1>
      <p className="mb-6 text-sm text-muted">
        Add products, pick what you&apos;re selling, then start your broadcast.
      </p>

      {error ? (
        <p className="mb-4 rounded-xl bg-live/10 px-3 py-2 text-sm text-live">
          {error}
        </p>
      ) : null}

      {/* Add product */}
      <form
        onSubmit={createProduct}
        className="mb-6 space-y-3 rounded-2xl border border-border bg-surface p-4"
      >
        <h2 className="text-sm font-semibold">Add a product</h2>
        <ImageUploader value={newImage} onChange={setNewImage} label="Photo" />
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Product title"
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />
        <div className="flex gap-3">
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Price (₹)"
            className="w-1/2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={newStock}
            onChange={(e) => setNewStock(e.target.value)}
            placeholder="Stock"
            className="w-1/2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-full bg-surface-2 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {creating ? "Adding…" : "+ Add product"}
        </button>
      </form>

      {/* Product picker */}
      <h2 className="mb-2 text-sm font-semibold">
        Pick products for this stream
      </h2>
      {products === null ? (
        <div className="space-y-2">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
        </div>
      ) : products.length === 0 ? (
        <p className="mb-4 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
          Add your first product above.
        </p>
      ) : (
        <div className="mb-4 space-y-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleSelected(p.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.99]",
                selected.has(p.id)
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-surface",
              )}
            >
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.title} fill sizes="48px" className="object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.title}</span>
                <span className="text-xs text-muted">
                  {formatPrice(p.priceInPaise)} · {p.availableStock} in stock
                </span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected.has(p.id) ? "border-primary bg-primary" : "border-faint",
                )}
              >
                {selected.has(p.id) ? (
                  <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={streamTitle}
        onChange={(e) => setStreamTitle(e.target.value)}
        placeholder="Stream title (optional)"
        className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
      />

      <button
        type="button"
        disabled={starting || selected.size === 0}
        onClick={goLive}
        className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40"
      >
        {starting ? "Starting…" : "Go live"}
      </button>
    </div>
  );
}
