import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccessToken, livekitConfigured, LIVEKIT_URL } from "@/lib/livekit";

/**
 * GET /api/livekit-token?streamId=...&secret=...
 *
 * Mints a LiveKit token for the room. `secret` is the stream's
 * broadcastSecret (only the seller's browser has it, from /api/stream/start)
 * — matching it is what grants publish rights. Everyone else, including a
 * missing/wrong secret, joins as a subscribe-only guest.
 */
export async function GET(req: NextRequest) {
  if (!livekitConfigured()) {
    return NextResponse.json(
      { error: "LiveKit is not configured on the server." },
      { status: 503 },
    );
  }

  const streamId = req.nextUrl.searchParams.get("streamId");
  if (!streamId) {
    return NextResponse.json({ error: "streamId is required" }, { status: 400 });
  }

  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream || stream.status !== "LIVE") {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const secret = req.nextUrl.searchParams.get("secret") ?? "";
  const isBroadcaster = Boolean(secret) && secret === stream.broadcastSecret;

  const identity = isBroadcaster
    ? `seller_${stream.id}`
    : `guest_${crypto.randomUUID().slice(0, 8)}`;

  // Guests pick (and locally persist) a display name so chat doesn't show
  // every viewer as "Guest" — trusted only as a label, never an identity.
  const rawName = req.nextUrl.searchParams.get("name") ?? "";
  const guestName = rawName.trim().slice(0, 24) || "Guest";

  const token = await createAccessToken({
    roomName: stream.livekitRoomName,
    identity,
    name: isBroadcaster ? "Seller" : guestName,
    canPublish: isBroadcaster,
  });

  return NextResponse.json({
    token,
    serverUrl: LIVEKIT_URL,
    isBroadcaster,
  });
}
