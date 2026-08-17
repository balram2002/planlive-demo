"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useIsMuted,
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

export type ViewerProduct = {
  id: string;
  title: string;
  priceInPaise: number;
  availableStock: number;
  imageUrl: string | null;
};

const VIEWER_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: false,
  dynacast: true,
};

export function ViewerRoom({
  streamId,
  startedAt,
  initialProducts,
}: {
  streamId: string;
  startedAt: string;
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
      <ViewerStage streamId={streamId} startedAt={startedAt} initialProducts={initialProducts} />
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-sm text-white/60">
          Camera is off
        </div>
      ) : null}
    </>
  );
}

function ViewerStage({
  streamId,
  startedAt,
  initialProducts,
}: {
  streamId: string;
  startedAt: string;
  initialProducts: ViewerProduct[];
}) {
  const connectionState = useConnectionState();
  const room = useRoomContext();
  const [products, setProducts] = useState<ViewerProduct[]>(initialProducts);
  const [panelOpen, setPanelOpen] = useState(false);
  const [buyFlow, setBuyFlow] = useState<BuyFlow | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoHidden, setVideoHidden] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);

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

      // Server-sent packets only (no `from` — can't be forged by a participant).
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
      }
    },
    [pushNotice],
  );
  useDataChannel(onData);

  const clearCelebration = useCallback(() => setCelebration(null), []);

  const announceShare = useCallback(() => {
    const payload = new TextEncoder().encode(JSON.stringify({ type: "share" }));
    room.localParticipant.publishData(payload, { reliable: false }).catch(() => {
      // Best-effort — the share itself already happened.
    });
    pushNotice("share", room.localParticipant.name || "You");
  }, [room, pushNotice]);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Live on liveWAB", url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareFlash(true);
        setTimeout(() => setShareFlash(false), 1500);
      }
      announceShare();
    } catch {
      // Cancelled share sheet, etc. — not an error.
    }
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
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            {connectionState === ConnectionState.Connected ? "Waiting for the seller's video…" : "Connecting…"}
          </div>
        )}
      </div>

      {!audioMuted ? <RoomAudioRenderer /> : null}

      {/* ---------- Header ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent p-3 pb-10">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-live">
            <span className="h-1.5 w-1.5 rounded-full bg-live animate-live-pulse" />
            Live
          </span>
          <Elapsed startedAt={startedAt} />
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <ViewerCount />
          <IconButton
            onClick={() => setAudioMuted((v) => !v)}
            active={audioMuted}
            label={audioMuted ? "Unmute" : "Mute"}
          >
            {audioMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          </IconButton>
          <IconButton
            onClick={() => setVideoHidden((v) => !v)}
            active={videoHidden}
            label={videoHidden ? "Show video" : "Hide video"}
          >
            {videoHidden ? <EyeOffIcon /> : <EyeIcon />}
          </IconButton>
          <IconButton onClick={onShare} label="Share">
            {shareFlash ? <CheckIcon /> : <ShareIcon />}
          </IconButton>
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

      <StartAudio
        label="Tap for sound"
        className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
      />

      <FloatingReactions floats={floats} onDone={remove} />
      <LiveNotices notices={notices} />
      <OrderCelebration celebration={celebration} onDone={clearCelebration} />

      {/* ---------- Bottom dock ---------- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-12">
        <ChatOverlay
          broadcasterIdentity={`seller_${streamId}`}
          className="pointer-events-auto w-full"
          actions={
            <>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
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

              <button
                type="button"
                onClick={() => react("❤️")}
                aria-label="Send a heart"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-lg backdrop-blur transition-transform active:scale-75"
              >
                ❤️
              </button>
            </>
          }
        />
      </div>

      <ProductsPanel open={panelOpen} onClose={() => setPanelOpen(false)} products={products} onBuy={startBuy} />
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

function IconButton({
  children,
  onClick,
  label,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition-all duration-200 active:scale-90 ${
        active ? "bg-live text-white" : "bg-black/60 text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="M17 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M3 3l18 18M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 6 10 6a13.4 13.4 0 0 1-3 3.6M7 7.3C4.2 9 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M12 3v12m0-12 4 4m-4-4-4 4M6 13v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stage({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black px-6 text-center">
      <p className={tone === "error" ? "text-sm text-live" : "text-sm text-white/70"}>{children}</p>
    </div>
  );
}
