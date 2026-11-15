import Fastify from "fastify";
import { registerRateLimit } from "../../apps/api/src/rate-limit.js";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";
import { execFileSync } from "node:child_process";
import { Queue } from "bullmq";
import { startMaintenanceQueue } from "../../apps/api/src/maintenance-queue.js";
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
      await expect(
        db.product.update({
          where: { id: product.id },
          data: { code: "changed" },
        }),
      ).rejects.toThrow();
      const plan = await db.plan.create({
        data: {
          code: "test",
          name: "Test",
          productScope: ["smoke"],
          kind: "base",
        },
      });
      const publishedAt = new Date();
      const version = await db.planVersion.create({
        data: {
          planId: plan.id,
          version: 1,
          publishedAt,
          effectiveFrom: publishedAt,
        },
      });
      await db.planVersion.update({
        where: { id: version.id },
        data: {
          effectiveTo: new Date(publishedAt.getTime() + 86400000),
          revokedAt: publishedAt,
        },
      });
      await expect(
        db.planVersion.update({
          where: { id: version.id },
          data: { creditGrants: { smoke: 10 } },
        }),
      ).rejects.toThrow();
      await expect(
        db.planVersion.create({
          data: {
            planId: plan.id,
            version: 2,
            publishedAt,
            effectiveFrom: new Date(0),
          },
        }),
      ).rejects.toThrow();
      const identity = await db.identity.create({ data: {} });
      await db.identityBinding.createMany({
        data: [
          { identityId: identity.id, issuer: "old", subject: "user" },
          { identityId: identity.id, issuer: "new", subject: "user" },
        ],
      });
      expect(
        await db.identityBinding.count({ where: { identityId: identity.id } }),
      ).toBe(2);
    } finally {
      await db.$disconnect();
    }
    const redis = await new RedisContainer("redis:8-alpine").start();
    try {
      const connection = {
        host: redis.getHost(),
        port: redis.getMappedPort(6379),
      };
      const http = Fastify();
      await registerRateLimit(http, connection);
      http.get("/limited", async () => ({ ok: true }));
      try {
        for (let index = 0; index < 120; index++) {
          expect((await http.inject({ url: "/limited" })).statusCode).toBe(200);
        }
        const blocked = await http.inject({ url: "/limited" });
        expect(blocked.statusCode).toBe(429);
        expect(blocked.json().code).toBe("RATE_LIMITED");
      } finally {
        await http.close();
      }
      const queue = new Queue("billing-maintenance", { connection });
      let completed!: () => void;
      let failed!: (error: Error) => void;
      const processed = new Promise<void>((resolve, reject) => {
        completed = resolve;
        failed = reject;
      });
      const close = await startMaintenanceQueue(
        connection,
        async () => completed(),
        failed,
      );
      try {
        await processed;
        expect(await queue.getJobSchedulersCount()).toBe(1);
      } finally {
        await close();
        await queue.close();
      }
    } finally {
      await redis.stop();
    }
  } finally {
    await postgres.stop();
  }
}, 120000);
