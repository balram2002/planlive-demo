import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/streams/:streamId — stream info + the products pinned to it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await params;
  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: { streamId: stream.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    stream: {
      id: stream.id,
      status: stream.status,
      title: stream.title,
      thumbnailUrl: stream.thumbnailUrl,
      startedAt: stream.startedAt.toISOString(),
    },
    products: products.map((p) => ({
      id: p.id,
      title: p.title,
      priceInPaise: p.priceInPaise,
      availableStock: p.availableStock,
      imageUrl: p.imageUrl,
    })),
  });
}
