import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSellerRequest } from "@/lib/seller-auth";

/** GET /api/streams/:streamId/stats — live sales stats for the seller console. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  if (!isSellerRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { streamId } = await params;

  const orders = await prisma.order.findMany({
    where: { streamId },
    select: { amountInPaise: true },
  });

  return NextResponse.json({
    orders: orders.length,
    revenuePaise: orders.reduce((sum, o) => sum + o.amountInPaise, 0),
  });
}
