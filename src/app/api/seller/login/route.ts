import { NextResponse, type NextRequest } from "next/server";
import {
  SELLER_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  mintSessionCookieValue,
  sellerAuthConfigured,
} from "@/lib/seller-auth";

/** POST /api/seller/login { password } — sets the seller session cookie. */
export async function POST(req: NextRequest) {
  if (!sellerAuthConfigured()) {
    return NextResponse.json(
      { error: "Seller login isn't configured on the server (SELLER_PASSWORD is unset)." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SELLER_COOKIE, mintSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
