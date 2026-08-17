import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSellerRequest } from "@/lib/seller-auth";

/**
 * GET /api/products — every product in the demo catalog, newest first.
 * Seller-only: buyers never see the full catalog, only what's pinned to a
 * live stream (via /api/streams/:id). Mutations are Server Actions — see
 * src/app/backstage-92k4x7/actions.ts.
 */
export async function GET(req: NextRequest) {
  if (!isSellerRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}
