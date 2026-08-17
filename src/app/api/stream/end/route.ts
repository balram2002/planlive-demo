import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteRoom } from "@/lib/livekit";
import { isSellerRequest } from "@/lib/seller-auth";

/** POST /api/stream/end { streamId, broadcastSecret } */
export async function POST(req: NextRequest) {
  if (!isSellerRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const streamId = String(body.streamId ?? "");
  const secret = String(body.broadcastSecret ?? "");

  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream || stream.status !== "LIVE") {
    return NextResponse.json({ error: "Stream isn't live." }, { status: 404 });
  }
  if (stream.broadcastSecret !== secret) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  await prisma.stream.update({
    where: { id: stream.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  await prisma.product.updateMany({
    where: { streamId: stream.id },
    data: { streamId: null },
  });

  await deleteRoom(stream.livekitRoomName);

  return NextResponse.json({ ok: true });
}
