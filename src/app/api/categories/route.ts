import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/categories — active categories. Public: the discover page's
 * category rail needs these too, and category names aren't sensitive.
 */
export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}
