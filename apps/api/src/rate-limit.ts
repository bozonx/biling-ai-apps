import rateLimit from "@fastify/rate-limit";
import { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";

export async function registerRateLimit(
  app: FastifyInstance,
  connection: { host: string; port: number },
) {
  const redis = new Redis({ ...connection, maxRetriesPerRequest: 1 });
  app.addHook("onClose", async () => {
    await redis.quit();
  });
  await app.register(rateLimit, {
    redis,
    max: 120,
    timeWindow: 60_000,
    errorResponseBuilder: () => ({ statusCode: 429, code: "RATE_LIMITED" }),
  });
}
