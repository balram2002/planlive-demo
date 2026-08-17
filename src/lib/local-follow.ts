"use client";

/**
 * "Follow" without accounts: there's no buyer identity for a Follow row to
 * belong to, so this is a per-browser, per-stream cosmetic toggle only —
 * it doesn't sync anywhere and won't survive clearing site data. Good
 * enough to make the interaction feel real in a demo; not a real feature.
 */
const KEY_PREFIX = "livewab_demo_follow_";

export function isFollowing(streamId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + streamId) === "1";
  } catch {
    return false;
  }
}

export function setFollowing(streamId: string, following: boolean): void {
  try {
    if (following) localStorage.setItem(KEY_PREFIX + streamId, "1");
    else localStorage.removeItem(KEY_PREFIX + streamId);
  } catch {
    // ignore
  }
}
