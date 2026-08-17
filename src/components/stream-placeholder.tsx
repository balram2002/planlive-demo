"use client";

export type PlaceholderState = "connecting" | "waiting" | "camera-off";

/** What a viewer sees in place of video: connecting / not-on-camera-yet / deliberately-off, each with its own voice. */
export function StreamPlaceholder({
  state,
  waitingLabel,
}: {
  state: PlaceholderState;
  waitingLabel?: string;
}) {
  const content =
    state === "connecting"
      ? { icon: <Spinner />, title: "Connecting…", body: "Getting you into the stream." }
      : state === "camera-off"
        ? {
            icon: <span className="text-3xl">🎥</span>,
            title: "Camera off",
            body: "The seller has turned their camera off for a moment. Audio and chat are still live.",
          }
        : {
            icon: <span className="text-3xl">📡</span>,
            title: waitingLabel ?? "Starting soon",
            body: "The seller hasn't gone on camera yet. Hang tight — the stream will appear here.",
          };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      {content.icon}
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{content.title}</p>
        <p className="max-w-xs text-xs leading-relaxed text-white/55">{content.body}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />;
}
