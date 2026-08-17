// One-off seed: a handful of categories for the go-live funnel's category
// picker. Safe to re-run — skips any name that already exists.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  "Fashion & Apparel",
  "Jewelry & Accessories",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Electronics",
];

for (const name of CATEGORIES) {
  const existing = await prisma.category.findFirst({ where: { name } });
  if (existing) {
    console.log(`= ${name} already exists`);
    continue;
  }
  const category = await prisma.category.create({ data: { name } });
  console.log(`✔ ${category.name} — ${category.id}`);
}

const total = await prisma.category.count();
console.log(`Done. Total categories now: ${total}`);
process.exit(0);
