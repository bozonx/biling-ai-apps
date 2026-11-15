import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { config } from "./config.js";
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
      },
    }),
    BullModule.registerQueue({ name: "billing" }),
  ],
})
class WorkerModule {}
NestFactory.createApplicationContext(WorkerModule)
  .then((app) => app.enableShutdownHooks())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
