import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceBreakdown } from "@/lib/pricing";
import { broadcastToRoom } from "@/lib/livekit";

/** "Priya Sharma" -> "Priya S." — shown to the whole room in the celebration overlay, so a full real name never gets broadcast. */
function displaySafeName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Someone";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * POST /api/orders
 * { productId, buyerName, buyerPhone, addressLine1, addressLine2?, city, state, pincode }
 *
 * Places a Cash-on-Delivery order. No accounts and no separate "reserve then
 * confirm" step — the stock decrement and the Order insert happen in one
 * transaction, guarded by a conditional updateMany (`availableStock >= 1`),
 * so two buyers racing the last unit can't both win.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productId = String(body.productId ?? "");
  const buyerName = String(body.buyerName ?? "").trim().slice(0, 80);
  const buyerPhone = String(body.buyerPhone ?? "").trim().slice(0, 20);
  const addressLine1 = String(body.addressLine1 ?? "").trim().slice(0, 160);
  const addressLine2 = String(body.addressLine2 ?? "").trim().slice(0, 160) || null;
  const city = String(body.city ?? "").trim().slice(0, 80);
  const state = String(body.state ?? "").trim().slice(0, 80);
  const pincode = String(body.pincode ?? "").trim().slice(0, 12);

  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }
  if (!/^\d{7,15}$/.test(buyerPhone)) {
    return NextResponse.json(
      { error: "Enter a valid mobile number." },
      { status: 400 },
    );
  }
  if (buyerName.length < 2) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!addressLine1 || !city || !state || !/^\d{4,10}$/.test(pincode)) {
    return NextResponse.json(
      { error: "Fill in a complete delivery address." },
      { status: 400 },
    );
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (!product.streamId) {
    return NextResponse.json(
      { error: "This product isn't in a live stream." },
      { status: 409 },
    );
  }
  const stream = await prisma.stream.findUnique({ where: { id: product.streamId } });
  if (!stream || stream.status !== "LIVE") {
    return NextResponse.json(
      { error: "This stream isn't live any more." },
      { status: 409 },
    );
  }

  const totals = priceBreakdown(product.priceInPaise);

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const decremented = await tx.product.updateMany({
        where: { id: product.id, availableStock: { gte: 1 } },
        data: { availableStock: { decrement: 1 } },
      });
      if (decremented.count === 0) {
        throw new Error("SOLD_OUT");
      }

      return tx.order.create({
        data: {
          productId: product.id,
          streamId: stream.id,
          productTitle: product.title,
          quantity: 1,
          itemsInPaise: totals.itemsInPaise,
          deliveryFeeInPaise: totals.deliveryFeeInPaise,
          amountInPaise: totals.totalInPaise,
          buyerName,
          buyerPhone,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SOLD_OUT") {
      return NextResponse.json(
        { error: "Sold out — someone got the last one." },
        { status: 409 },
      );
    }
    console.error("Order placement failed:", err);
    return NextResponse.json(
      { error: "Couldn't place the order. Try again." },
      { status: 500 },
    );
  }

  const remainingStock = product.availableStock - 1;
  await broadcastToRoom(stream.livekitRoomName, {
    type: "stock",
    productId: product.id,
    availableStock: remainingStock,
  });
  await broadcastToRoom(stream.livekitRoomName, {
    type: "order-celebration",
    buyerName: displaySafeName(buyerName),
    productTitle: product.title,
    productImageUrl: product.imageUrl,
    quantity: 1,
  });

  return NextResponse.json({
    orderId: order.id,
    itemsInPaise: totals.itemsInPaise,
    deliveryFeeInPaise: totals.deliveryFeeInPaise,
    amountInPaise: order.amountInPaise,
    availableStock: remainingStock,
  });
}
