"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

export type NoticeKind = "join" | "like" | "share" | "follow";

export type Notice = {
  id: number;
  kind: NoticeKind;
  name: string;
};

const MAX_VISIBLE = 3;
const LIFETIME_MS = 4200;

const copy: Record<NoticeKind, { emoji: string; verb: string; ring: string; glow: string }> = {
  join: {
    emoji: "👋",
    verb: "joined",
    ring: "border-white/15",
    glow: "shadow-[0_0_18px_-6px_rgba(255,255,255,0.45)]",
  },
  like: {
    emoji: "❤️",
    verb: "liked the stream",
    ring: "border-rose-400/40",
    glow: "shadow-[0_0_18px_-6px_rgba(244,63,94,0.75)]",
  },
  share: {
    emoji: "🔗",
    verb: "shared the stream",
    ring: "border-sky-400/40",
    glow: "shadow-[0_0_18px_-6px_rgba(56,189,248,0.7)]",
  },
  follow: {
    emoji: "⭐",
    verb: "followed",
    ring: "border-amber-300/45",
    glow: "shadow-[0_0_18px_-6px_rgba(252,211,77,0.75)]",
  },
};

/** Rolling activity feed for the live room ("Guest4821 joined", "Guest90 liked…"). */
export function useLiveNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const push = useCallback((kind: NoticeKind, name: string) => {
    const id = nextId.current++;
    setNotices((prev) => [...prev, { id, kind, name }].slice(-MAX_VISIBLE));

    const timer = setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
      timers.current.delete(timer);
    }, LIFETIME_MS);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return { notices, push };
}

export function LiveNotices({ notices, className }: { notices: Notice[]; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute left-3 top-24 z-20 flex w-[62%] max-w-[260px] flex-col items-start gap-1.5",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {notices.map((notice) => {
          const { emoji, verb, ring, glow } = copy[notice.kind];
          return (
            <motion.div
              key={notice.id}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "flex max-w-full items-center gap-1.5 rounded-full border bg-black/55 py-1 pl-1 pr-2.5 backdrop-blur-md",
                ring,
                glow,
              )}
            >
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] leading-none"
              >
                {emoji}
              </span>
              <span className="min-w-0 truncate text-[11px] text-white">
                <span className="font-semibold">{notice.name}</span>{" "}
                <span className="text-white/70">{verb}</span>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
