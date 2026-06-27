import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

let _prisma: PrismaClient | undefined;

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[Prisma] Missing DATABASE_URL environment variable");
    throw new Error("Missing DATABASE_URL");
  }
  const adapter = new PrismaNeon({ connectionString: url });
  return new PrismaClient({ adapter });
}

export function prisma(): PrismaClient {
  if (!_prisma) _prisma = createPrisma();
  return _prisma;
}
