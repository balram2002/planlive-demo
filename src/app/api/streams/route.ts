import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/streams — every currently-live stream, for the Discover page. */
export async function GET() {
  const streams = await prisma.stream.findMany({
    where: { status: "LIVE" },
    orderBy: { startedAt: "desc" },
  });

  const productCounts = await prisma.product.groupBy({
    by: ["streamId"],
    where: { streamId: { in: streams.map((s) => s.id) } },
    _count: { _all: true },
  });
  const countByStream = new Map(
    productCounts.map((c) => [c.streamId, c._count._all]),
  );

  return NextResponse.json({
    streams: streams.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      startedAt: s.startedAt.toISOString(),
      productCount: countByStream.get(s.id) ?? 0,
    })),
  });
}
