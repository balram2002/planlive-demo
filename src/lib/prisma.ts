import { PrismaClient } from "@prisma/client";

/**
 * Fail loudly and immediately with an actionable message, instead of letting
 * a misconfigured DATABASE_URL surface as a multi-line MongoDB driver/Atlas
 * proxy stack trace three layers deep inside whatever query happened to run
 * first. The single most common mistake: pasting the connection string
 * straight from Atlas's "Connect" dialog, which omits the database name.
 */
function assertDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "[prisma] DATABASE_URL is not set. Add it in your host's environment " +
        "variables (Vercel: Project -> Settings -> Environment Variables) " +
        "and redeploy — .env.local is never deployed.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("[prisma] DATABASE_URL is not a valid connection string URL.");
  }
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) {
    throw new Error(
      "[prisma] DATABASE_URL is missing a database name. It needs a segment " +
        "like '/livewab_demo' right before the '?', e.g.:\n" +
        "  mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/livewab_demo?retryWrites=true&w=majority\n" +
        "This is almost always copy-pasted straight from Atlas's \"Connect\" " +
        "dialog, which omits it.",
    );
  }
}

assertDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
