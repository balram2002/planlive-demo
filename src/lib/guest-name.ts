"use client";

const KEY = "livewab_demo_guest_name";

/** Stable per-browser display name for chat/reactions — not an identity, just a label. */
export function getGuestName(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const name = `Guest${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(KEY, name);
    return name;
  } catch {
    return "Guest";
  }
}
