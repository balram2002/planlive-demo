// No "server-only" guard — imported from route handlers and server actions.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const SELLER_PASSWORD = process.env.SELLER_PASSWORD ?? "";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export const SELLER_COOKIE = "livewab_seller_session";
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

export function sellerAuthConfigured(): boolean {
  return SELLER_PASSWORD.length > 0;
}

/** HMAC over the expiry timestamp, keyed by the seller password itself — no
 * separate secret or session store needed, and it's stateless (works across
 * serverless instances). Whoever can produce a valid signature already knows
 * the password. */
function sign(expiresAt: number): string {
  return crypto.createHmac("sha256", SELLER_PASSWORD).update(String(expiresAt)).digest("hex");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  if (!sellerAuthConfigured()) return false;
  return timingSafeStringEqual(candidate, SELLER_PASSWORD);
}

export function mintSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function verifySessionCookieValue(value: string | undefined | null): boolean {
  if (!value || !sellerAuthConfigured()) return false;
  const [expiresAtRaw, signature] = value.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return false;
  return timingSafeStringEqual(signature, sign(expiresAt));
}

/** True when the request carries a valid, unexpired seller session cookie. */
export function isSellerRequest(req: NextRequest): boolean {
  return verifySessionCookieValue(req.cookies.get(SELLER_COOKIE)?.value);
}

/**
 * For Server Actions, which read the request's cookies via next/headers
 * rather than a NextRequest. Throws so every action fails loudly and
 * uniformly on an invalid/expired/missing session — there's no page to
 * redirect back to from inside an action.
 */
export async function requireSellerSession(): Promise<void> {
  const store = await cookies();
  if (!verifySessionCookieValue(store.get(SELLER_COOKIE)?.value)) {
    throw new Error("Not authorized.");
  }
}
