// Quick standalone connectivity check: `npm run db:check`.
// Catches the two failure modes that actually happen with this app's setup —
// a DATABASE_URL missing the database name segment, and Atlas network-access
// rejecting the connecting IP — with a message that says which one it is,
// instead of a raw driver stack trace.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [streams, products, orders] = await Promise.all([
    prisma.stream.count(),
    prisma.product.count(),
    prisma.order.count(),
  ]);
  console.log("✔ Database reachable.");
  console.log(`  streams=${streams} products=${products} orders=${orders}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("✘ Could not reach the database.\n");
  if (message.includes("empty database name")) {
    console.error(
      "DATABASE_URL is missing a database name in its path — it needs a\n" +
        "segment like /livewab_demo before the '?', e.g.:\n" +
        "  mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/livewab_demo?retryWrites=true&w=majority",
    );
  } else if (
    message.includes("Server selection timeout") ||
    message.includes("received fatal alert")
  ) {
    console.error(
      "This looks like an Atlas Network Access problem, not a code bug:\n" +
        "  - In Atlas -> Network Access, add 0.0.0.0/0 (or your host's IP) to the allowlist.\n" +
        "  - If deployed on Vercel, its outbound IPs are dynamic — 0.0.0.0/0 is required\n" +
        "    unless you're using Vercel's Secure Compute / a static-IP add-on.\n" +
        "  - Confirm the cluster isn't paused.",
    );
  } else {
    console.error(message);
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
