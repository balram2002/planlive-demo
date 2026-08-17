"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BroadcasterRoom } from "./broadcaster-room";
import { LiveConsole } from "./live-console";
import { ImageUploader } from "./image-uploader";
import { AttributesEditor } from "./products/attributes-editor";
import { Button } from "./ui/button";
import { Spinner } from "./ui/action-button";
import { EmptyState } from "./ui/empty-state";
import { useToast } from "./toast";
import { formatPrice } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import {
  createProduct,
  startStream,
  endStream,
  type ProductFormState,
  type StartStreamState,
} from "@/app/backstage-92k4x7/actions";

const STORAGE_KEY = "livewab_demo_broadcast";

type Product = {
  id: string;
  title: string;
  priceInPaise: number;
  availableStock: number;
  imageUrl: string | null;
};

type Category = { id: string; name: string };

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

type AuthPhase = "checking" | "locked" | "unlocked";

/**
 * Password gate wrapping the whole studio. The page also lives at an
 * unlinked-by-default URL, but that's only obscurity — every seller-only
 * mutation independently checks the session cookie this gate sets, so the
 * real protection is the password, not the hidden path.
 */
export function SellerStudio() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seller/session");
        const body = await res.json();
        setAuthPhase(body.authenticated ? "unlocked" : "locked");
      } catch {
        setAuthPhase("locked");
      }
    })();
  }, []);

  if (authPhase === "checking") {
    return <div className="skeleton mx-auto h-64 max-w-sm" />;
  }
  if (authPhase === "locked") {
    return <PasswordGate onUnlock={() => setAuthPhase("unlocked")} />;
  }
  return <SellerConsole onLocked={() => setAuthPhase("locked")} />;
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Wrong password.");
        return;
      }
      onUnlock();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-xs rounded-2xl border border-border bg-surface p-6 shadow-pop">
        <span className="mb-3 block text-2xl">🔒</span>
        <h1 className="mb-1 text-lg font-bold tracking-tight">Seller access</h1>
        <p className="mb-4 text-sm text-muted">Enter the password to continue.</p>

        {error ? <p className="mb-3 rounded-xl bg-live/10 px-3 py-2 text-sm text-live">{error}</p> : null}

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />

        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

function SellerConsole({ onLocked }: { onLocked: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);

  async function loadProducts() {
    const res = await fetch("/api/products");
    const body = await res.json();
    setProducts(body.products ?? []);
  }

  async function loadCategories() {
    const res = await fetch("/api/categories");
    const body = await res.json();
    setCategories(body.categories ?? []);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/stream/active");
      const body = await res.json();
      if (body.stream) {
        const stored = loadStoredBroadcast();
        if (stored && stored.streamId === body.stream.id) {
          setPhase({ kind: "live", streamId: body.stream.id, secret: stored.secret, startedAt: body.stream.startedAt });
          return;
        }
        setPhase({ kind: "blocked" });
        return;
      }
      await Promise.all([loadProducts(), loadCategories()]);
      setPhase({ kind: "setup" });
    })();
  }, []);

  async function logout() {
    await fetch("/api/seller/logout", { method: "POST" });
    onLocked();
  }

  async function endStreamAndReset(streamId: string, secret: string) {
    const fd = new FormData();
    fd.set("streamId", streamId);
    fd.set("broadcastSecret", secret);
    await endStream(fd);
    localStorage.removeItem(STORAGE_KEY);
    await Promise.all([loadProducts(), loadCategories()]);
    setPhase({ kind: "setup" });
  }

  if (phase.kind === "loading") {
    return <div className="skeleton mx-auto h-96 max-w-lg" />;
  }

  if (phase.kind === "blocked") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          A stream is already live from another browser/session. End it there first, or wait for it to finish.
        </p>
      </div>
    );
  }

  if (phase.kind === "live") {
    return (
      <div className="animate-page-in mx-auto max-w-5xl space-y-5 lg:grid lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="lg:col-span-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">You&apos;re live</h1>
            <p className="text-sm text-muted">Buyers can find your stream on Discover.</p>
          </div>
          <button type="button" onClick={logout} className="text-xs font-medium text-muted transition-colors hover:text-foreground">
            Lock
          </button>
        </div>

        <div className="space-y-4">
          <BroadcasterRoom streamId={phase.streamId} broadcastSecret={phase.secret} startedAt={phase.startedAt} />
          <button
            type="button"
            onClick={() => {
              haptics.impact();
              void endStreamAndReset(phase.streamId, phase.secret);
            }}
            className="w-full rounded-full bg-live py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
          >
            End stream
          </button>
        </div>

        <LiveConsole streamId={phase.streamId} />
      </div>
    );
  }

  // ---- setup phase ----
  return (
    <div className="animate-page-in mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Go live</h1>
          <p className="text-sm text-muted">Add products, pick what you&apos;re selling, then start your broadcast.</p>
        </div>
        <button type="button" onClick={logout} className="text-xs font-medium text-muted transition-colors hover:text-foreground">
          Lock
        </button>
      </div>

      <AddProductCard onAdded={loadProducts} />

      {products === null || categories === null ? (
        <div className="space-y-2">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon="📦" title="Add a product first" description="You need at least one product before you can go live." />
      ) : (
        <GoLiveForm
          products={products}
          categories={categories}
          onLive={(streamId, secret) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ streamId, secret }));
            setPhase({ kind: "live", streamId, secret, startedAt: new Date().toISOString() });
          }}
        />
      )}
    </div>
  );
}

function AddProductCard({ onAdded }: { onAdded: () => void }) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(createProduct, {});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const handledSuccess = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.error) toast({ title: state.error, variant: "error" });
  }, [state.error, toast]);

  useEffect(() => {
    if (!state.success || state.success === handledSuccess.current) return;
    handledSuccess.current = state.success;
    toast({ title: state.success, variant: "success" });
    setImageUrl(null);
    onAdded();
  }, [state.success, toast, onAdded]);

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Add a product</h2>
      <ImageUploader kind="product" value={imageUrl} onChange={setImageUrl} aspect="tile" label="Photo" />
      <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />
      <input
        name="title"
        required
        minLength={2}
        maxLength={100}
        placeholder="Product title"
        className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
      />
      <div className="flex gap-3">
        <input
          name="price"
          type="number"
          inputMode="decimal"
          min={1}
          step="0.01"
          required
          placeholder="Price (₹)"
          className="w-1/2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />
        <input
          name="stock"
          type="number"
          inputMode="numeric"
          min={0}
          step="1"
          required
          placeholder="Stock"
          className="w-1/2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />
      </div>
      <div className="rounded-2xl border border-border p-3">
        <AttributesEditor compact />
      </div>
      <button
        type="submit"
        disabled={pending || !imageUrl}
        className="w-full rounded-full bg-surface-2 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> Adding…
          </span>
        ) : !imageUrl ? (
          "Add a photo to continue"
        ) : (
          "+ Add product"
        )}
      </button>
    </form>
  );
}

function GoLiveForm({
  products,
  categories,
  onLive,
}: {
  products: Product[];
  categories: Category[];
  onLive: (streamId: string, secret: string) => void;
}) {
  const [state, formAction, pending] = useActionState<StartStreamState, FormData>(startStream, {});
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) toast({ title: state.error, variant: "error" });
  }, [state.error, toast]);

  useEffect(() => {
    if (state.streamId && state.broadcastSecret) {
      onLive(state.streamId, state.broadcastSecret);
    }
    // Only fire once per successful start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.streamId, state.broadcastSecret]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="live-title" className="mb-1.5 block text-sm font-medium text-muted">
          Stream title <span className="font-normal text-faint">(optional)</span>
        </label>
        <input
          id="live-title"
          name="title"
          maxLength={80}
          placeholder="Friday drip drop 🔥"
          className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-base text-foreground placeholder:text-faint focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <ImageUploader kind="thumbnail" label="Stream cover (optional — falls back to the first product's photo)" value={thumbnailUrl} onChange={setThumbnailUrl} aspect="portrait" />
      <input type="hidden" name="thumbnailUrl" value={thumbnailUrl ?? ""} />

      <div>
        <label htmlFor="live-category" className="mb-1.5 block text-sm font-medium text-muted">
          Category (required)
        </label>
        <select
          id="live-category"
          name="categoryId"
          required
          defaultValue=""
          className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-base text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="" disabled>
            What are you selling today?
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {categories.length === 0 ? (
          <p className="mt-1.5 text-xs text-warning">No active categories configured.</p>
        ) : null}
      </div>

      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-medium text-muted">Feature products in this stream</legend>
        {products.map((product) => (
          <label
            key={product.id}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5"
          >
            <input
              type="checkbox"
              name="productIds"
              value={product.id}
              defaultChecked={product.availableStock > 0}
              className="h-4 w-4 shrink-0 accent-primary"
            />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2">🏷️</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{product.title}</span>
              <span className="text-xs text-muted">
                {formatPrice(product.priceInPaise)} · {product.availableStock > 0 ? `${product.availableStock} in stock` : "sold out"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error ? (
        <p className="rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-sm text-live">{state.error}</p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || categories.length === 0}
        className={cn("w-full")}
        onClick={() => haptics.impact()}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> Starting…
          </span>
        ) : (
          "🔴 Go live"
        )}
      </Button>
    </form>
  );
}
