import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/products — every product in the demo catalog, newest first. */
export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}

/** Only ever accept images we hosted ourselves (ImageKit or local /uploads). */
function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (/^\/uploads\/[a-z0-9_-]+\.(jpg|png|webp)$/i.test(value)) return value;
  if (/^https:\/\/ik\.imagekit\.io\/[^\s"'<>]+$/i.test(value)) return value;
  return null;
}

/** POST /api/products { title, priceInPaise, availableStock, imageUrl } */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, 100);
  if (title.length < 2) {
    return NextResponse.json(
      { error: "Enter a product title." },
      { status: 400 },
    );
  }

  // Client sends this already converted to paise (rupees * 100).
  const priceInPaise = Number(body.priceInPaise);
  if (
    !Number.isFinite(priceInPaise) ||
    priceInPaise < 100 ||
    priceInPaise > 100_000_000
  ) {
    return NextResponse.json(
      { error: "Enter a valid price (at least ₹1)." },
      { status: 400 },
    );
  }

  const stock = Number(body.availableStock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
    return NextResponse.json(
      { error: "Enter a valid stock count." },
      { status: 400 },
    );
  }

  const imageUrl = sanitizeImageUrl(body.imageUrl);
  if (!imageUrl) {
    return NextResponse.json(
      { error: "Add a product photo before saving." },
      { status: 400 },
    );
  }

  const product = await prisma.product.create({
    data: {
      title,
      priceInPaise: Math.round(priceInPaise),
      availableStock: stock,
      imageUrl,
    },
  });

  return NextResponse.json({ product });
}
