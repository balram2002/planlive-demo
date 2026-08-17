import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/time";

/** GET /api/streams?category=id — every currently-live stream, for the discover page. */
export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get("category");

  const [streams, categories] = await Promise.all([
    prisma.stream.findMany({
      where: { status: "LIVE", ...(categoryId ? { categoryId } : {}) },
      orderBy: { startedAt: "desc" },
      take: 24,
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const streamIds = streams.map((s) => s.id);
  const [productCounts, products] = await Promise.all([
    prisma.product.groupBy({
      by: ["streamId"],
      where: { streamId: { in: streamIds } },
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { streamId: { in: streamIds } },
      select: { streamId: true, priceInPaise: true },
    }),
  ]);
  const countByStream = new Map(productCounts.map((c) => [c.streamId, c._count._all]));
  const minPriceByStream = new Map<string, number>();
  for (const p of products) {
    if (!p.streamId) continue;
    const current = minPriceByStream.get(p.streamId);
    if (current === undefined || p.priceInPaise < current) minPriceByStream.set(p.streamId, p.priceInPaise);
  }

  return NextResponse.json({
    streams: streams.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      categoryName: categoryNameById.get(s.categoryId) ?? null,
      startedAgo: timeAgo(s.startedAt),
      productCount: countByStream.get(s.id) ?? 0,
      fromPaise: minPriceByStream.get(s.id) ?? null,
    })),
  });
}
