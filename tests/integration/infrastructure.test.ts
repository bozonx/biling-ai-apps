import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";
import { execFileSync } from "node:child_process";
import { Queue, Worker } from "bullmq";
test("migrations, Prisma round trip and Redis job processing", async () => {
  const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
  try {
    execFileSync("pnpm", ["db:deploy"], {
      env: { ...process.env, DATABASE_URL: postgres.getConnectionUri() },
    });
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    try {
      const product = await db.product.create({
        data: { code: "smoke", name: "Smoke" },
      });
      expect(
        await db.product.findUnique({ where: { id: product.id } }),
      ).toMatchObject({ code: "smoke" });
    } finally {
      await db.$disconnect();
    }
    const redis = await new RedisContainer("redis:8-alpine").start();
    try {
      const connection = {
        host: redis.getHost(),
        port: redis.getMappedPort(6379),
      };
      const queue = new Queue("smoke", { connection });
      const worker = new Worker("smoke", async (job) => job.data, {
        connection,
      });
      try {
        const completed = new Promise((resolve) =>
          worker.once("completed", resolve),
        );
        await queue.add("ping", { ok: true });
        await completed;
      } finally {
        await worker.close();
        await queue.close();
      }
    } finally {
      await redis.stop();
    }
  } finally {
    await postgres.stop();
  }
}, 120000);
