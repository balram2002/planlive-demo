"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSellerSession } from "@/lib/seller-auth";
import { broadcastToRoom, deleteRoom } from "@/lib/livekit";
import { sanitizeImageUrl } from "@/lib/sanitize-image";
import { findPreset, parseAttributes, serializeAttributes } from "@/lib/product-attributes";

const PATH = "/backstage-92k4x7";

/* ------------------------------------------------------------------ */
/* Catalog                                                              */
/* ------------------------------------------------------------------ */

export type ProductFormState = { error?: string; success?: string };

/** Add a product to the catalog — not yet pinned to any stream. */
export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSellerSession();

  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  if (title.length < 2) return { error: "Enter a product title." };

  const priceRupees = Number(formData.get("price"));
  if (!Number.isFinite(priceRupees) || priceRupees < 1 || priceRupees > 1_000_000) {
    return { error: "Enter a valid price (at least ₹1)." };
  }
  const stock = Number(formData.get("stock"));
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
    return { error: "Enter a valid stock count." };
  }
  const imageUrl = sanitizeImageUrl(formData.get("imageUrl"));
  if (!imageUrl) return { error: "Add a product photo before saving." };

  const attributesJson = serializeAttributes(
    parseAttributes(String(formData.get("attributesJson") ?? "")),
  );
  const rawType = String(formData.get("productType") ?? "").trim();

  const product = await prisma.product.create({
    data: {
      title,
      priceInPaise: Math.round(priceRupees * 100),
      availableStock: stock,
      imageUrl,
      productType: findPreset(rawType) ? rawType : null,
      attributesJson,
    },
  });

  revalidatePath(PATH);
  return { success: `${product.title} added.` };
}

/* ------------------------------------------------------------------ */
/* Go live / end stream                                                */
/* ------------------------------------------------------------------ */

export type StartStreamState = {
  error?: string;
  streamId?: string;
  broadcastSecret?: string;
};

/**
 * Starts a live stream: creates the Stream doc with a unique LiveKit room
 * name, pins the selected products to it, and hands back a broadcastSecret —
 * the only proof of "you're the broadcaster" this app has, since there's no
 * per-user auth. The caller stores it (localStorage) and presents it to
 * /api/livekit-token and endStream below.
 */
export async function startStream(
  _prev: StartStreamState,
  formData: FormData,
): Promise<StartStreamState> {
  await requireSellerSession();

  const existing = await prisma.stream.findFirst({ where: { status: "LIVE" } });
  if (existing) return { error: "A stream is already live." };

  const productIds = formData.getAll("productIds").map(String).filter(Boolean);
  if (productIds.length === 0) {
    return { error: "Pick at least one product to feature in the stream." };
  }

  const owned = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, imageUrl: true },
  });
  if (owned.length === 0) return { error: "No valid products selected." };

  const categoryId = String(formData.get("categoryId") ?? "");
  const category = categoryId ? await prisma.category.findUnique({ where: { id: categoryId } }) : null;
  if (!category || !category.isActive) {
    return { error: "Pick a category for your stream." };
  }

  const thumbnailUrl = sanitizeImageUrl(formData.get("thumbnailUrl")) ?? owned[0].imageUrl ?? null;
  if (!thumbnailUrl) return { error: "Add a stream cover image before going live." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 80) || null;

  const broadcastSecret = crypto.randomBytes(24).toString("hex");

  const stream = await prisma.stream.create({
    data: {
      livekitRoomName: `stream_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      broadcastSecret,
      status: "LIVE",
      title,
      thumbnailUrl,
      categoryId: category.id,
    },
  });

  await prisma.product.updateMany({
    where: { id: { in: owned.map((p) => p.id) } },
    data: { streamId: stream.id },
  });

  revalidatePath("/");
  return { streamId: stream.id, broadcastSecret };
}

/** Ends a stream: marks it ENDED, unpins products, and closes the LiveKit room. */
export async function endStream(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireSellerSession();

  const streamId = String(formData.get("streamId") ?? "");
  const secret = String(formData.get("broadcastSecret") ?? "");

  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream || stream.status !== "LIVE") return { ok: false, error: "Stream isn't live." };
  if (stream.broadcastSecret !== secret) return { ok: false, error: "Not authorized." };

  await prisma.stream.update({
    where: { id: stream.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  await prisma.product.updateMany({
    where: { streamId: stream.id },
    data: { streamId: null },
  });

  await deleteRoom(stream.livekitRoomName);

  revalidatePath("/");
  revalidatePath(PATH);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Live console — used mid-stream without leaving the studio. Each one   */
/* revalidates the studio and broadcasts so viewers update in real time. */
/* ------------------------------------------------------------------ */

/** Loads + authorizes a LIVE stream, or null. Single-seller demo: any valid session may act on the (one) live stream. */
async function ownedLiveStream(streamId: string) {
  const stream = await prisma.stream.findUnique({ where: { id: streamId } });
  if (!stream || stream.status !== "LIVE") return null;
  return stream;
}

export type LiveProductState = { error?: string; success?: string };

/** Quick-create a product mid-stream and drop it straight into the live queue. */
export async function createProductInLive(
  _prev: LiveProductState,
  formData: FormData,
): Promise<LiveProductState> {
  await requireSellerSession();
  const streamId = String(formData.get("streamId") ?? "");

  const stream = await ownedLiveStream(streamId);
  if (!stream) return { error: "Your stream isn't live." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const priceRupees = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));

  if (title.length < 2) return { error: "Enter a product title." };
  if (!Number.isFinite(priceRupees) || priceRupees < 1 || priceRupees > 1_000_000) {
    return { error: "Enter a valid price (at least ₹1)." };
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
    return { error: "Enter a valid stock count." };
  }

  const imageUrl = sanitizeImageUrl(formData.get("imageUrl"));
  if (!imageUrl) return { error: "Add a product photo before adding it." };

  const attributesJson = serializeAttributes(
    parseAttributes(String(formData.get("attributesJson") ?? "")),
  );
  const rawType = String(formData.get("productType") ?? "").trim();

  const product = await prisma.product.create({
    data: {
      title,
      priceInPaise: Math.round(priceRupees * 100),
      availableStock: stock,
      imageUrl,
      productType: findPreset(rawType) ? rawType : null,
      attributesJson,
      streamId: stream.id,
    },
  });

  await broadcastToRoom(stream.livekitRoomName, { type: "products-changed" });
  revalidatePath(PATH);
  return { success: `${product.title} added to your stream.` };
}

/** Add one of the seller's existing products to the live queue. */
export async function addProductToStream(
  _prev: LiveProductState,
  formData: FormData,
): Promise<LiveProductState> {
  await requireSellerSession();
  const streamId = String(formData.get("streamId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const stream = await ownedLiveStream(streamId);
  if (!stream) return { error: "Your stream isn't live any more." };

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "That product no longer exists." };
  if (product.streamId === stream.id) {
    return { success: `${product.title} is already in this stream.` };
  }
  if (product.streamId) {
    const holder = await prisma.stream.findUnique({
      where: { id: product.streamId },
      select: { status: true },
    });
    if (holder && holder.status === "LIVE") {
      return { error: `${product.title} is already featured in another live stream.` };
    }
  }

  const updated = await prisma.product.updateMany({
    where: { id: productId, streamId: product.streamId },
    data: { streamId: stream.id },
  });
  if (updated.count === 0) return { error: "Couldn't add it just now — try again." };

  await broadcastToRoom(stream.livekitRoomName, { type: "products-changed" });
  revalidatePath(PATH);
  return { success: `${product.title} added to your stream.` };
}

/** Remove a product from the live queue (unpins featured if needed). */
export async function removeProductFromStream(formData: FormData): Promise<void> {
  await requireSellerSession();
  const streamId = String(formData.get("streamId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const stream = await ownedLiveStream(streamId);
  if (!stream) return;

  const updated = await prisma.product.updateMany({
    where: { id: productId, streamId: stream.id },
    data: { streamId: null },
  });
  if (updated.count === 0) return;

  if (stream.featuredProductId === productId) {
    await prisma.stream.update({ where: { id: stream.id }, data: { featuredProductId: null } });
  }

  await broadcastToRoom(stream.livekitRoomName, { type: "products-changed" });
  revalidatePath(PATH);
}

/** Pin (or unpin) the "currently featured" product viewers see first. */
export async function setFeaturedProduct(formData: FormData): Promise<void> {
  await requireSellerSession();
  const streamId = String(formData.get("streamId") ?? "");
  const productId = String(formData.get("productId") ?? ""); // empty = unpin

  const stream = await ownedLiveStream(streamId);
  if (!stream) return;

  let featured: string | null = null;
  let featuredTitle: string | null = null;
  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.streamId !== stream.id) return;
    featured = productId;
    featuredTitle = product.title;
  }

  await prisma.stream.update({ where: { id: stream.id }, data: { featuredProductId: featured } });

  await broadcastToRoom(stream.livekitRoomName, {
    type: "featured",
    productId: featured,
    productTitle: featuredTitle,
  });
  revalidatePath(PATH);
}

/** Adjust a live product's stock by ±1 without leaving the stream. */
export async function adjustStock(formData: FormData): Promise<void> {
  await requireSellerSession();
  const streamId = String(formData.get("streamId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const delta = Number(formData.get("delta"));
  if (![1, -1].includes(delta)) return;

  const stream = await ownedLiveStream(streamId);
  if (!stream) return;

  const updated = await prisma.product.updateMany({
    where: {
      id: productId,
      streamId: stream.id,
      ...(delta < 0 ? { availableStock: { gte: 1 } } : {}),
    },
    data: { availableStock: { increment: delta } },
  });
  if (updated.count === 0) return;

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { availableStock: true } });
  if (product) {
    await broadcastToRoom(stream.livekitRoomName, {
      type: "stock",
      productId,
      availableStock: product.availableStock,
    });
  }
  revalidatePath(PATH);
}
