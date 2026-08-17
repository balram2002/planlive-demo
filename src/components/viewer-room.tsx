"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useIsMuted,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import {
  ConnectionState,
  RemoteTrackPublication,
  Track,
  VideoQuality,
  type RoomOptions,
} from "livekit-client";
import { useLivekitToken } from "./use-livekit-token";
import { Elapsed } from "./elapsed";
import { ProductsPanel } from "./products-panel";
import { BuyDrawer, type BuyFlow } from "./buy-drawer";

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
      <ViewerStage startedAt={startedAt} initialProducts={initialProducts} />
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
  startedAt,
  initialProducts,
}: {
  startedAt: string;
  initialProducts: ViewerProduct[];
}) {
  const connectionState = useConnectionState();
  const [products, setProducts] = useState<ViewerProduct[]>(initialProducts);
  const [panelOpen, setPanelOpen] = useState(false);
  const [buyFlow, setBuyFlow] = useState<BuyFlow | null>(null);

  const onData = useCallback((msg: { payload: Uint8Array }) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(new TextDecoder().decode(msg.payload));
    } catch {
      return;
    }
    if (data?.type === "stock" && typeof data.productId === "string") {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.productId
            ? { ...p, availableStock: Number(data.availableStock) }
            : p,
        ),
      );
    }
  }, []);
  useDataChannel(onData);

  const remoteCamera = useTracks([Track.Source.Camera]).find(
    (t) => !t.participant.isLocal,
  );

  const [wasConnected, setWasConnected] = useState(false);
  if (connectionState === ConnectionState.Connected && !wasConnected) {
    setWasConnected(true);
  }
  const streamOver = wasConnected && connectionState === ConnectionState.Disconnected;

  function startBuy(product: ViewerProduct) {
    setPanelOpen(false);
    setBuyFlow({ product });
  }

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
      <div className="absolute inset-0">
        {remoteCamera ? (
          <RemoteVideo trackRef={remoteCamera} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            {connectionState === ConnectionState.Connected
              ? "Waiting for the seller's video…"
              : "Connecting…"}
          </div>
        )}
      </div>

      <RoomAudioRenderer />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-live">
            <span className="h-1.5 w-1.5 rounded-full bg-live animate-live-pulse" />
            Live
          </span>
          <Elapsed startedAt={startedAt} />
        </div>
        <Link
          href="/"
          aria-label="Leave stream"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-all duration-200 active:scale-90"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      <StartAudio
        label="Tap for sound"
        className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
      />

      {/* Bottom dock: products button */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-black/70 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-12">
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-pop transition-all active:scale-95"
        >
          🛍️ Shop ({products.length})
        </button>
      </div>

      <ProductsPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        products={products}
        onBuy={startBuy}
      />
      <BuyDrawer
        flow={buyFlow}
        onClose={() => setBuyFlow(null)}
        onStockChange={(productId, availableStock) =>
          setProducts((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, availableStock } : p)),
          )
        }
      />
    </div>
  );
}

function Stage({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black px-6 text-center">
      <p className={tone === "error" ? "text-sm text-live" : "text-sm text-white/70"}>
        {children}
      </p>
    </div>
  );
}
