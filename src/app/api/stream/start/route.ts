import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSellerRequest } from "@/lib/seller-auth";

function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (/^\/uploads\/[a-z0-9_-]+\.(jpg|png|webp)$/i.test(value)) return value;
  if (/^https:\/\/ik\.imagekit\.io\/[^\s"'<>]+$/i.test(value)) return value;
  return null;
}

/**
 * POST /api/stream/start { productIds: string[], title?, thumbnailUrl? }
 *
 * Only one live stream exists at a time in this demo (no seller accounts to
 * scope by). Creates the Stream row, pins the chosen products to it, and
 * hands back a broadcastSecret — the ONLY proof of "you're the broadcaster"
 * this app has, since there's no auth. The caller must keep it (localStorage)
 * and pass it back to /api/livekit-token and /api/stream/end.
 */
export async function POST(req: NextRequest) {
  if (!isSellerRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const existing = await prisma.stream.findFirst({ where: { status: "LIVE" } });
  if (existing) {
    return NextResponse.json(
      { error: "A stream is already live." },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productIds = Array.isArray(body.productIds)
    ? body.productIds.filter((id): id is string => typeof id === "string")
    : [];
  if (productIds.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one product to feature." },
      { status: 400 },
    );
  }

  const owned = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, imageUrl: true },
  });
  if (owned.length === 0) {
    return NextResponse.json(
      { error: "No valid products selected." },
      { status: 400 },
    );
  }

  const title =
    String(body.title ?? "").trim().slice(0, 80) || null;
  const thumbnailUrl =
    sanitizeImageUrl(body.thumbnailUrl) ?? owned[0].imageUrl ?? null;

  const broadcastSecret = crypto.randomBytes(24).toString("hex");

  const stream = await prisma.stream.create({
    data: {
      livekitRoomName: `stream_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      broadcastSecret,
      status: "LIVE",
      title,
      thumbnailUrl,
    },
  });

  await prisma.product.updateMany({
    where: { id: { in: owned.map((p) => p.id) } },
    data: { streamId: stream.id },
  });

  return NextResponse.json({
    streamId: stream.id,
    broadcastSecret,
  });
}
