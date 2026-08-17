import { NextResponse, type NextRequest } from "next/server";
import { SELLER_COOKIE, verifySessionCookieValue } from "@/lib/seller-auth";

/** GET /api/seller/session — whether this browser already has a valid session. */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SELLER_COOKIE)?.value;
  return NextResponse.json({ authenticated: verifySessionCookieValue(cookie) });
}
