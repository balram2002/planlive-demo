import { NextResponse } from "next/server";
import { SELLER_COOKIE } from "@/lib/seller-auth";

/** POST /api/seller/logout — clears the seller session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SELLER_COOKIE);
  return res;
}
