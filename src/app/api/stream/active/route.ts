import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/stream/active — the current live stream, if any (public info
 * only — never the broadcastSecret). Used by the seller page to resume the
 * studio view after a page refresh.
 */
export async function GET() {
  const stream = await prisma.stream.findFirst({ where: { status: "LIVE" } });
  if (!stream) return NextResponse.json({ stream: null });

  return NextResponse.json({
    stream: {
      id: stream.id,
      title: stream.title,
      thumbnailUrl: stream.thumbnailUrl,
      startedAt: stream.startedAt.toISOString(),
    },
  });
}
