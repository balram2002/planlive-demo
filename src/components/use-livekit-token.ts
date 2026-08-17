"use client";

import { useEffect, useState } from "react";
import { getGuestName } from "@/lib/guest-name";

export type TokenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      token: string;
      serverUrl: string;
      isBroadcaster: boolean;
    };

/** Fetches a LiveKit token for a stream. `secret` (broadcastSecret) is only ever passed by the seller's own studio view. */
export function useLivekitToken(
  streamId: string,
  secret?: string | null,
): TokenState {
  const [state, setState] = useState<TokenState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const qs = new URLSearchParams({ streamId });
        if (secret) qs.set("secret", secret);
        else qs.set("name", getGuestName());
        const res = await fetch(`/api/livekit-token?${qs.toString()}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({
            status: "error",
            message: body.error ?? "Couldn't connect to the stream.",
          });
          return;
        }
        setState({
          status: "ready",
          token: body.token,
          serverUrl: body.serverUrl,
          isBroadcaster: body.isBroadcaster,
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Network error." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [streamId, secret]);

  return state;
}
