"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useIsMuted,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import {
  ConnectionState,
  RemoteTrackPublication,
  RoomEvent,
  Track,
  VideoQuality,
  type RemoteParticipant,
  type RoomOptions,
} from "livekit-client";
import { useLivekitToken } from "./use-livekit-token";
import { Elapsed } from "./elapsed";
import { ProductsPanel } from "./products-panel";
import { BuyDrawer, type BuyFlow } from "./buy-drawer";
import { ChatOverlay } from "./chat";
import { FloatingReactions, useReactions } from "./reactions";
import { LiveNotices, useLiveNotices } from "./live-notices";
import { OrderCelebration, type Celebration } from "./order-celebration";
import { ViewerCount } from "./viewer-count";
import { ViewerMenu } from "./viewer-menu";
import { ShareModal } from "./share-modal";
import { StreamPlaceholder } from "./stream-placeholder";
import { AttributeChips } from "@/components/products/attribute-chips";
import { formatPrice } from "@/lib/format";
import { headlineAttributes, type ProductAttribute } from "@/lib/product-attributes";
import { isFollowing, setFollowing } from "@/lib/local-follow";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/cn";

export type ViewerProduct = {
  id: string;
  title: string;
  priceInPaise: number;
  availableStock: number;
  imageUrl: string | null;
  attributes: ProductAttribute[];
};

const VIEWER_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: false,
  dynacast: true,
};

export function ViewerRoom({
  streamId,
  startedAt,
  thumbnailUrl,
  featuredProductId,
  initialProducts,
}: {
  streamId: string;
  startedAt: string;
  thumbnailUrl: string | null;
  featuredProductId: string | null;
  initialProducts: ViewerProduct[];
}) {
  const token = useLivekitToken(streamId);

  if (token.status === "loading") {
    return <Stage>Joining stream…</Stage>;
  }
  if (token.status === "error") {
    return <Stage tone="error">{token.message}</Stage>;
  }

  return (
    <LiveKitRoom
      token={token.token}
      serverUrl={token.serverUrl}
      connect
      video={false}
      audio={false}
      options={VIEWER_ROOM_OPTIONS}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ViewerStage
        streamId={streamId}
        startedAt={startedAt}
        thumbnailUrl={thumbnailUrl}
        initialFeaturedId={featuredProductId}
        initialProducts={initialProducts}
      />
    </LiveKitRoom>
  );
}

function RemoteVideo({ trackRef }: { trackRef: TrackReference }) {
  const publication = trackRef.publication;
  useEffect(() => {
    if (!(publication instanceof RemoteTrackPublication)) return;
    try {
      publication.setVideoQuality(VideoQuality.HIGH);
    } catch {
      // Not yet subscribed — retried on next render.
    }
  }, [publication]);

  const cameraOff = useIsMuted(trackRef);

  return (
    <>
      <VideoTrack trackRef={trackRef} className="absolute inset-0 h-full w-full object-cover" />
      {cameraOff ? (
        <div className="absolute inset-0 bg-black/90">
          <StreamPlaceholder state="camera-off" />
        </div>
      ) : null}
    </>
  );
}

function ViewerStage({
  streamId,
  startedAt,
  thumbnailUrl,
  initialFeaturedId,
  initialProducts,
}: {
  streamId: string;
  startedAt: string;
  thumbnailUrl: string | null;
  initialFeaturedId: string | null;
  initialProducts: ViewerProduct[];
}) {
  const connectionState = useConnectionState();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [products, setProducts] = useState<ViewerProduct[]>(initialProducts);
  const [featuredId, setFeaturedId] = useState<string | null>(initialFeaturedId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [buyFlow, setBuyFlow] = useState<BuyFlow | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoHidden, setVideoHidden] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // ViewerStage only ever mounts client-side (LiveKitRoom gates it behind an
  // async token fetch, so this never runs during SSR) — safe to read
  // localStorage directly in the initializer instead of syncing via effect.
  const [following, setFollowingState] = useState(() => isFollowing(streamId));
  const [followBusy, setFollowBusy] = useState(false);

  const { floats, remove, react } = useReactions();
  const { notices, push: pushNotice } = useLiveNotices();
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrationId = useRef(0);
  const lastLikeAt = useRef<Map<string, number>>(new Map());
  const LIKE_NOTICE_WINDOW_MS = 8000;

  useEffect(() => {
    const onJoin = (participant: RemoteParticipant) => {
      pushNotice("join", participant.name || "someone");
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, pushNotice]);

  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/streams/${streamId}`);
      if (!res.ok) return;
      const json = await res.json();
      setProducts(json.products);
      setFeaturedId(json.stream.featuredProductId ?? null);
    } catch {
      // Transient — next broadcast will retry.
    }
  }, [streamId]);

  const onData = useCallback(
    (msg: { payload: Uint8Array; from?: { identity: string; name?: string } }) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(new TextDecoder().decode(msg.payload));
      } catch {
        return;
      }

      if (msg.from) {
        const who = msg.from.name || "someone";
        if (data?.type === "reaction") {
          const now = Date.now();
          const previous = lastLikeAt.current.get(msg.from.identity) ?? 0;
          if (now - previous > LIKE_NOTICE_WINDOW_MS) {
            lastLikeAt.current.set(msg.from.identity, now);
            pushNotice("like", who);
          }
        } else if (data?.type === "share") {
          pushNotice("share", who);
        }
        return;
      }

      // Server packets only — a client can't forge these (no `from`).
      if (data?.type === "order-celebration") {
        setCelebration({
          id: ++celebrationId.current,
          buyerName: String(data.buyerName ?? "Someone"),
          productTitle: String(data.productTitle ?? "an item"),
          productImageUrl: typeof data.productImageUrl === "string" ? data.productImageUrl : null,
          quantity: Number(data.quantity) || 1,
        });
      } else if (data?.type === "stock" && typeof data.productId === "string") {
        setProducts((prev) =>
          prev.map((p) => (p.id === data.productId ? { ...p, availableStock: Number(data.availableStock) } : p)),
        );
      } else if (data?.type === "products-changed") {
        void refreshProducts();
      } else if (data?.type === "featured") {
        setFeaturedId(typeof data.productId === "string" ? data.productId : null);
      }
    },
    [pushNotice, refreshProducts],
  );
  useDataChannel(onData);

  const clearCelebration = useCallback(() => setCelebration(null), []);

  const announceShare = useCallback(() => {
    const payload = new TextEncoder().encode(JSON.stringify({ type: "share" }));
    localParticipant.publishData(payload, { reliable: false }).catch(() => {});
    pushNotice("share", localParticipant.name || "You");
  }, [localParticipant, pushNotice]);

  function toggleFollow() {
    haptics.tap();
    setFollowBusy(true);
    const next = !following;
    setFollowingState(next);
    setFollowing(streamId, next);
    if (next) pushNotice("follow", localParticipant.name || "You");
    setFollowBusy(false);
  }

  const remoteCamera = useTracks([Track.Source.Camera]).find((t) => !t.participant.isLocal);

  const lastTap = useRef(0);
  function onStageTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      react("❤️");
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
  }

  function startBuy(product: ViewerProduct) {
    haptics.tap();
    setPanelOpen(false);
    setBuyFlow({ product });
  }

  const [wasConnected, setWasConnected] = useState(false);
  if (connectionState === ConnectionState.Connected && !wasConnected) {
    setWasConnected(true);
  }
  const streamOver = wasConnected && connectionState === ConnectionState.Disconnected;

  if (streamOver) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <span className="text-3xl">🌙</span>
        <h2 className="text-lg font-semibold text-white">Stream ended</h2>
        <p className="text-sm text-white/60">Find more sellers on Discover.</p>
        <Link
          href="/"
          className="mt-1 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.97]"
        >
          Browse live streams
        </Link>
      </div>
    );
  }

  const featuredProduct = featuredId ? (products.find((p) => p.id === featuredId) ?? null) : null;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
      <div className="absolute inset-0" onClick={onStageTap}>
        {videoHidden ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-2xl">📵</span>
            <p className="text-sm text-white/60">Video hidden to save data — audio keeps playing.</p>
          </div>
        ) : remoteCamera ? (
          <RemoteVideo trackRef={remoteCamera} />
        ) : (
          <StreamPlaceholder state={connectionState !== ConnectionState.Connected ? "connecting" : "waiting"} waitingLabel="Starting soon" />
        )}
      </div>

      {!audioMuted ? <RoomAudioRenderer /> : null}

      {/* ---------- Header ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 via-black/30 to-transparent p-3 pb-10">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-black/50 py-1 pl-2.5 pr-1.5 backdrop-blur">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-live">
              <span className="h-1.5 w-1.5 rounded-full bg-live animate-live-pulse" />
              Live
            </span>
            <Elapsed startedAt={startedAt} />
            <motion.button
              type="button"
              disabled={followBusy}
              onClick={toggleFollow}
              whileTap={{ scale: 0.92 }}
              className={cn(
                "ml-1 shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors duration-300",
                following ? "bg-white/15 text-white/80" : "bg-primary text-white",
              )}
            >
              {following ? "Following" : "Follow"}
            </motion.button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <ViewerCount />
            <ViewerMenu
              audioMuted={audioMuted}
              onToggleAudio={() => setAudioMuted((v) => !v)}
              videoHidden={videoHidden}
              onToggleVideo={() => setVideoHidden((v) => !v)}
              onOpenShare={() => setShareOpen(true)}
            />
            <Link
              href="/"
              aria-label="Leave stream"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-all duration-200 active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <StartAudio
        label="Tap for sound"
        className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
      />

      <FloatingReactions floats={floats} onDone={remove} />
      <LiveNotices notices={notices} />
      <OrderCelebration celebration={celebration} onDone={clearCelebration} />

      {/* ---------- Pinned product card ---------- */}
      <AnimatePresence>
        {featuredProduct ? (
          <motion.div
            key={featuredProduct.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 z-30 w-32"
          >
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/70 backdrop-blur">
              <div className="relative aspect-square w-full overflow-hidden bg-white/5">
                {featuredProduct.imageUrl ? (
                  <Image src={featuredProduct.imageUrl} alt={featuredProduct.title} fill sizes="128px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-3xl">🏷️</span>
                )}
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
                  📌 Pinned
                </span>
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-white">{featuredProduct.title}</p>
                <p className="mt-0.5 text-xs font-bold text-white">{formatPrice(featuredProduct.priceInPaise)}</p>
                <AttributeChips attributes={headlineAttributes(featuredProduct.attributes)} tone="dark" size="xs" className="mt-1" />
                <p className="mt-0.5 text-[10px] text-white/60">
                  {featuredProduct.availableStock > 0 ? `${featuredProduct.availableStock} left` : "Sold out"}
                </p>
                <motion.button
                  type="button"
                  disabled={featuredProduct.availableStock <= 0}
                  onClick={() => startBuy(featuredProduct)}
                  whileTap={{ scale: 0.95 }}
                  className="mt-1.5 w-full rounded-full bg-primary py-1.5 text-[11px] font-bold text-white transition-colors disabled:bg-white/10 disabled:text-white/40"
                >
                  {featuredProduct.availableStock <= 0 ? "Sold out" : "Buy Now"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---------- Bottom dock ---------- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-12">
        <ChatOverlay
          broadcasterIdentity={`seller_${streamId}`}
          className="pointer-events-auto w-full"
          listClassName={featuredProduct ? "mr-32" : undefined}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setPanelOpen(true);
                }}
                aria-label={`See products (${products.length})`}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-all duration-200 active:scale-90"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                  <path
                    d="M5 8h14l-1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Zm4 0a3 3 0 0 1 6 0"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
                {products.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {products.length}
                  </span>
                ) : null}
              </button>

              <motion.button
                type="button"
                onClick={() => react("❤️")}
                aria-label="Send a heart"
                whileTap={{ scale: 0.7 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-lg backdrop-blur"
              >
                ❤️
              </motion.button>
            </>
          }
        />
      </div>

      <ProductsPanel open={panelOpen} onClose={() => setPanelOpen(false)} products={products} featuredId={featuredId} onBuy={startBuy} />

      <ShareModal
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
          announceShare();
        }}
        target={{
          url: `/live/${streamId}`,
          title: "Live on liveWAB",
          description:
            products.length > 0
              ? `${products.length} ${products.length === 1 ? "product" : "products"} up for grabs — reserve instantly with Buy Now.`
              : "Watch live and shop in real time.",
          imageUrl: thumbnailUrl,
          badge: "Live now",
        }}
      />

      <BuyDrawer
        flow={buyFlow}
        onClose={() => setBuyFlow(null)}
        onStockChange={(productId, availableStock) =>
          setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, availableStock } : p)))
        }
      />
    </div>
  );
}

function Stage({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black px-6 text-center">
      <p className={tone === "error" ? "text-sm text-live" : "text-sm text-white/70"}>{children}</p>
    </div>
  );
}
