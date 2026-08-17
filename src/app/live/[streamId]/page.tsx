import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ViewerRoom } from "@/components/viewer-room";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-3xl">🌙</span>
        <h1 className="text-xl font-semibold">This stream has ended</h1>
        <p className="text-sm text-muted">
          Check the Discover page for sellers who are live right now.
        </p>
        <Link
          href="/discover"
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
    <div className="flex min-h-screen flex-1 flex-col">
      <ViewerRoom
        streamId={stream.id}
        startedAt={stream.startedAt.toISOString()}
        initialProducts={products.map((p) => ({
          id: p.id,
          title: p.title,
          priceInPaise: p.priceInPaise,
          availableStock: p.availableStock,
          imageUrl: p.imageUrl,
        }))}
      />
    </div>
  );
}
