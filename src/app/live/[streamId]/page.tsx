import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ViewerRoom } from "@/components/viewer-room";
import { parseAttributes } from "@/lib/product-attributes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ streamId: string }>;
}): Promise<Metadata> {
  const fallback: Metadata = {
    title: "Live stream",
    description: "Watch live and shop in real time on liveWAB.",
  };
  try {
    const { streamId } = await params;
    const stream = await prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) return fallback;
    if (stream.status !== "LIVE") {
      return { title: "Stream ended", robots: { index: false } };
    }
    const productCount = await prisma.product.count({ where: { streamId: stream.id } });
    const title = stream.title ?? "Live now";
    const description = `${productCount} ${productCount === 1 ? "product" : "products"} up for grabs — reserve instantly with Buy Now.`;
    const images = stream.thumbnailUrl ? [{ url: stream.thumbnailUrl }] : undefined;
    return {
      title,
      description,
      openGraph: { title, description, url: `/live/${stream.id}`, type: "video.other", images },
      twitter: { card: images ? "summary_large_image" : "summary", title, description, images },
    };
  } catch {
    return fallback;
  }
}

export default async function LiveStreamPage({
  params,
}: {
  params: Promise<{ streamId: string }>;
}) {
  const { streamId } = await params;

  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream) notFound();

  if (stream.status !== "LIVE") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-3xl">🌙</span>
        <h1 className="text-xl font-semibold">This stream has ended</h1>
        <p className="text-sm text-muted">
          Check the Discover page for sellers who are live right now.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Browse live streams
        </Link>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: { streamId: stream.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ViewerRoom
        streamId={stream.id}
        startedAt={stream.startedAt.toISOString()}
        thumbnailUrl={stream.thumbnailUrl}
        featuredProductId={stream.featuredProductId}
        initialProducts={products.map((p) => ({
          id: p.id,
          title: p.title,
          priceInPaise: p.priceInPaise,
          availableStock: p.availableStock,
          imageUrl: p.imageUrl,
          attributes: parseAttributes(p.attributesJson),
        }))}
      />
    </div>
  );
}
