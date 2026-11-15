import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client.js";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  try {
    await db.product.upsert({
      where: { code: "tyco" },
      create: { code: "tyco", name: "TyCo" },
      update: {},
    });
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
