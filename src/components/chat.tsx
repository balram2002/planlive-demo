"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { cn } from "@/lib/cn";

type ChatPayload = {
  type: "chat";
  id: string;
  text: string;
  userId: string;
  name: string;
};

type ChatMessage = {
  id: string;
  kind: "chat" | "system";
  text: string;
  userId: string;
  name: string;
};

const MAX_MESSAGES = 50;
const MAX_TEXT_LENGTH = 200;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Ephemeral live chat over the LiveKit data channel — nothing is stored in
 * the database, it only exists for as long as the room does.
 * - Join notifications appear as muted system rows.
 * - The broadcaster can moderate: delete a message or mute a sender for
 *   everyone; clients only honor moderation packets that arrive from the
 *   broadcaster's server-issued identity (spoof-proof — identities are set
 *   by the token route, not the client).
 */
export function ChatOverlay({
  className,
  listClassName,
  broadcasterIdentity,
  canModerate = false,
  actions,
}: {
  className?: string;
  listClassName?: string;
  broadcasterIdentity: string;
  canModerate?: boolean;
  actions?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const mutedRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const append = useCallback((msg: ChatMessage) => {
    if (mutedRef.current.has(msg.userId)) return;
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, []);

  useEffect(() => {
    const onJoin = (participant: RemoteParticipant) => {
      append({
        id: `sys_${participant.sid}_${Date.now()}`,
        kind: "system",
        text: `${participant.name || "someone"} joined`,
        userId: participant.identity,
        name: "",
      });
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, append]);

  const onData = useCallback(
    (msg: { payload: Uint8Array; from?: { identity: string; name?: string } }) => {
      try {
        const data = JSON.parse(decoder.decode(msg.payload));
        const fromIdentity = msg.from?.identity;

        if (!msg.from) return; // server packets (stock, celebration) handled elsewhere

        if (data?.type === "chat" && typeof data.text === "string") {
          append({
            id: String(data.id ?? `${fromIdentity}_${Date.now()}`),
            kind: "chat",
            text: String(data.text).slice(0, MAX_TEXT_LENGTH),
            userId: fromIdentity ?? String(data.userId ?? "unknown"),
            name: msg.from?.name || String(data.name ?? "someone"),
          });
          return;
        }

        // Moderation packets are only honored from the broadcaster.
        if (fromIdentity !== broadcasterIdentity) return;

        if (data?.type === "chat-delete" && typeof data.id === "string") {
          setMessages((prev) => prev.filter((m) => m.id !== data.id));
        } else if (data?.type === "chat-mute" && typeof data.identity === "string") {
          mutedRef.current.add(data.identity);
          setMessages((prev) => prev.filter((m) => m.userId !== data.identity));
        }
      } catch {
        // Not JSON / not for us.
      }
    },
    [append, broadcasterIdentity],
  );

  const { send } = useDataChannel(onData);

  const displayName = localParticipant.name || "you";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim().slice(0, MAX_TEXT_LENGTH);
    if (!text) return;
    setDraft("");

    const payload: ChatPayload = {
      type: "chat",
      id: `${localParticipant.identity}_${counter.current++}_${Date.now()}`,
      text,
      userId: localParticipant.identity,
      name: displayName,
    };
    append({ ...payload, kind: "chat" }); // local echo
    try {
      await send(encoder.encode(JSON.stringify(payload)), { reliable: true });
    } catch {
      // Connection hiccup — the message still shows locally.
    }
  }

  const moderate = useCallback(
    async (packet: Record<string, unknown>) => {
      try {
        await send(encoder.encode(JSON.stringify(packet)), { reliable: true });
      } catch {
        // Best-effort.
      }
    },
    [send],
  );

  const deleteMessage = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      void moderate({ type: "chat-delete", id });
    },
    [moderate],
  );

  const muteUser = useCallback(
    (identity: string) => {
      mutedRef.current.add(identity);
      setMessages((prev) => prev.filter((m) => m.userId !== identity));
      void moderate({ type: "chat-mute", identity });
    },
    [moderate],
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div
        ref={listRef}
        className={cn(
          "no-scrollbar max-h-40 space-y-1.5 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_20%)]",
          listClassName,
        )}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <ChatRow
              key={msg.id}
              msg={msg}
              canModerate={canModerate && msg.kind === "chat"}
              isOwn={msg.userId === localParticipant.identity}
              onDelete={deleteMessage}
              onMute={muteUser}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex h-11 items-center gap-2">
        <form onSubmit={submit} className="flex h-full min-w-0 flex-1 items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_TEXT_LENGTH}
            placeholder="Say something…"
            className="h-full min-w-0 flex-1 rounded-full border border-white/15 bg-black/50 px-4 text-base text-white placeholder:text-white/40 backdrop-blur focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all duration-200 active:scale-90 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5" aria-hidden>
              <path d="M3.6 3.9a.7.7 0 0 1 .95-.8l16.2 8.06a.7.7 0 0 1 0 1.26L4.55 20.5a.7.7 0 0 1-.95-.8l1.6-6.4a.7.7 0 0 1 .52-.51l6.4-1.3-6.4-1.3a.7.7 0 0 1-.52-.5l-1.6-6.4Z" />
            </svg>
          </button>
        </form>
        {actions}
      </div>
    </div>
  );
}

const ChatRow = memo(function ChatRow({
  msg,
  canModerate,
  isOwn,
  onDelete,
  onMute,
}: {
  msg: ChatMessage;
  canModerate: boolean;
  isOwn: boolean;
  onDelete: (id: string) => void;
  onMute: (identity: string) => void;
}) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group flex items-start gap-1.5"
    >
      {msg.kind === "system" ? (
        <p className="text-[11px] italic leading-snug text-white/50 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {msg.text}
        </p>
      ) : (
        <>
          <p className="min-w-0 text-[13px] leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            <span className="mr-1.5 font-semibold text-white/60">{msg.name}</span>
            {msg.text}
          </p>
          {canModerate && !isOwn ? (
            <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onDelete(msg.id)}
                aria-label="Delete message"
                className="rounded-full bg-black/50 px-1.5 text-[10px] text-white/70 hover:text-white"
              >
                ✕
              </button>
              <button
                type="button"
                onClick={() => onMute(msg.userId)}
                aria-label={`Mute ${msg.name}`}
                className="rounded-full bg-black/50 px-1.5 text-[10px] text-white/70 hover:text-live"
              >
                🚫
              </button>
            </span>
          ) : null}
        </>
      )}
    </motion.div>
  );
});
