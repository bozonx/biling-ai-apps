import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue({ name: "billing" }),
  ],
})
class WorkerModule {}
void NestFactory.createApplicationContext(WorkerModule).then((app) =>
  app.enableShutdownHooks(),
);
