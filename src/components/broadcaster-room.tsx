"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useConnectionState,
  useTrackToggle,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track, VideoPresets, type RoomOptions } from "livekit-client";
import { useLivekitToken } from "./use-livekit-token";
import { Elapsed } from "./elapsed";
import { cn } from "@/lib/cn";

const ROOM_OPTIONS: RoomOptions = {
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720],
    videoCodec: "h264",
  },
};

/** Seller's broadcast surface: local camera preview + camera/mic toggles. */
export function BroadcasterRoom({
  streamId,
  broadcastSecret,
  startedAt,
}: {
  streamId: string;
  broadcastSecret: string;
  startedAt: string;
}) {
  const token = useLivekitToken(streamId, broadcastSecret);

  if (token.status === "loading") {
    return <Stage>Connecting to your stream…</Stage>;
  }
  if (token.status === "error") {
    return <Stage tone="error">{token.message}</Stage>;
  }
  if (!token.isBroadcaster) {
    return <Stage tone="error">Only the stream owner can broadcast here.</Stage>;
  }

  return (
    <LiveKitRoom
      token={token.token}
      serverUrl={token.serverUrl}
      connect
      video
      audio
      options={ROOM_OPTIONS}
      className="block"
    >
      <BroadcasterStage startedAt={startedAt} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function DeviceToggle({
  source,
  onIcon,
  offIcon,
  label,
}: {
  source: Track.Source.Camera | Track.Source.Microphone;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
}) {
  const { enabled, pending, toggle } = useTrackToggle({ source });
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={enabled}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-colors duration-200 disabled:opacity-50",
          enabled ? "bg-white text-black" : "bg-live text-white",
        )}
      >
        {enabled ? onIcon : offIcon}
      </button>
      <span className="text-[10px] font-medium text-white/70">{label}</span>
    </div>
  );
}

function BroadcasterStage({ startedAt }: { startedAt: string }) {
  const connectionState = useConnectionState();

  const cameraTracks = useTracks([Track.Source.Camera]).filter(
    (t) => t.participant.isLocal,
  );
  const preview = cameraTracks[0];

  return (
    <div className="relative aspect-[9/14] w-full overflow-hidden rounded-2xl border border-border bg-black">
      {preview ? (
        <VideoTrack trackRef={preview} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/60">
          {connectionState === ConnectionState.Connected
            ? "Starting camera…"
            : "Connecting…"}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
        <span className="flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-live-pulse" />
          Live
        </span>
        <Elapsed startedAt={startedAt} />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12">
        <DeviceToggle
          source={Track.Source.Camera}
          label="Camera"
          onIcon={<CameraIcon />}
          offIcon={<CameraOffIcon />}
        />
        <DeviceToggle
          source={Track.Source.Microphone}
          label="Mic"
          onIcon={<MicIcon />}
          offIcon={<MicOffIcon />}
        />
      </div>
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
    <div className="flex aspect-[9/14] w-full items-center justify-center rounded-2xl border border-border bg-surface px-6 text-center">
      <p className={tone === "error" ? "text-sm text-live" : "text-sm text-muted"}>
        {children}
      </p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect x="3" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15 10 6-3v10l-6-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function CameraOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect x="3" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15 10 6-3v10l-6-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
