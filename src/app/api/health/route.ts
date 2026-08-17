import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { livekitConfigured } from "@/lib/livekit";
import { imagekitConfigured } from "@/lib/imagekit";
import { sellerAuthConfigured } from "@/lib/seller-auth";

/**
 * GET /api/health — one URL to check whether a deployment is actually
 * configured correctly, instead of digging through function logs. Reports
 * config presence and a live DB round-trip; never leaks secret values.
 */
export async function GET() {
  let database: { ok: true; productCount: number } | { ok: false; error: string };
  try {
    const productCount = await prisma.product.count();
    database = { ok: true, productCount };
  } catch (err) {
    database = {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown database error.",
    };
  }

  const checks = {
    database,
    livekitConfigured: livekitConfigured(),
    imagekitConfigured: imagekitConfigured(),
    sellerAuthConfigured: sellerAuthConfigured(),
  };

  const allOk =
    database.ok &&
    checks.livekitConfigured &&
    checks.imagekitConfigured &&
    checks.sellerAuthConfigured;

  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 503 });
}
