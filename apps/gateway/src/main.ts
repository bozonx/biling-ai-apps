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
      logger: true,
      bodyLimit: 1048576,
      trustProxy: (_address: string, hop: number) => hop < 1,
    }),
  );
  // Only deploy behind one trusted proxy; restrict direct access to prevent IP spoofing.
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  await app.register(helmet);
  app.enableShutdownHooks();
  await app.listen(config.GATEWAY_PORT, "0.0.0.0");
}
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
