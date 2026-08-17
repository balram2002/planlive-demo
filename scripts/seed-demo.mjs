// One-off seed: 5 demo products with real hosted images (via ImageKit, same
// path the app's own uploader uses) so the discover/live-room UI has
// something real to show. Safe to re-run — it just adds more rows; delete
// via `npm run db:check` + a manual cleanup if you want a clean slate.
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;

// Tiny solid-color 1x1 JPEGs — render fine as flat swatches via object-cover.
const SWATCHES = {
  red: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AKgH/9k=",
};

async function uploadPlaceholder(fileName) {
  if (!IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_PUBLIC_KEY) {
    throw new Error("ImageKit env vars not set — can't upload seed images.");
  }
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 10 * 60;
  const signature = crypto
    .createHmac("sha1", IMAGEKIT_PRIVATE_KEY)
    .update(token + expire)
    .digest("hex");

  const bytes = Buffer.from(SWATCHES.red, "base64");
  const form = new FormData();
  form.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  form.append("signature", signature);
  form.append("expire", String(expire));
  form.append("token", token);
  form.append("folder", "/livewab-demo/products");
  form.append("fileName", fileName);
  form.append("useUniqueFileName", "true");
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), fileName);

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`ImageKit upload failed: ${JSON.stringify(body)}`);
  return body.url;
}

const DEMO_PRODUCTS = [
  { title: "Handloom Cotton Kurta", priceInPaise: 129900, availableStock: 12 },
  { title: "Block-Print Saree", priceInPaise: 249900, availableStock: 6 },
  { title: "Leather Sling Bag", priceInPaise: 189900, availableStock: 9 },
  { title: "Silver Oxidised Earrings", priceInPaise: 59900, availableStock: 20 },
  { title: "Handmade Ceramic Mug Set", priceInPaise: 79900, availableStock: 15 },
];

const existing = await prisma.product.count();
console.log(`Existing products before seed: ${existing}`);

for (const [i, p] of DEMO_PRODUCTS.entries()) {
  const imageUrl = await uploadPlaceholder(`demo-product-${i + 1}.jpg`);
  const product = await prisma.product.create({ data: { ...p, imageUrl } });
  console.log(`✔ ${product.title} — ${product.id}`);
}

const total = await prisma.product.count();
console.log(`Done. Total products now: ${total}`);
process.exit(0);
