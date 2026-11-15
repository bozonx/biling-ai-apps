import { registerRateLimit } from "./rate-limit.js";
import { logger, nestLogger } from "./logging.js";
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { config } from "./config.js";
import helmet from "@fastify/helmet";
import { AppModule } from "./module.js";
async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      loggerInstance: logger,
      bodyLimit: 1048576,
      trustProxy: (_address: string, hop: number) => hop < 1,
    }),
    { logger: nestLogger },
  );
  // Only deploy behind one trusted proxy; restrict direct access to prevent IP spoofing.
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  await app.register(helmet);
  await registerRateLimit(app.getHttpAdapter().getInstance(), {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
  });
  app.enableShutdownHooks();
  await app.listen(config.API_PORT, "0.0.0.0");
}
main().catch((error: unknown) => {
  logger.error(
    { errorType: error instanceof Error ? error.name : "Unknown" },
    "API startup failed",
  );
  process.exit(1);
});
