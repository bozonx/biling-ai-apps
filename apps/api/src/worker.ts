import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { Database } from "./database.js";
import { WalletService } from "./wallet.js";
import { Module } from "@nestjs/common";
@Module({ providers: [Database, WalletService] })
class WorkerModule {}
NestFactory.createApplicationContext(WorkerModule)
  .then((app) => {
    app.enableShutdownHooks();
    let running = false;
    const timer = setInterval(() => {
      if (running) return;
      running = true;
      void app
        .get(WalletService)
        .expireHolds()
        .catch((error: unknown) => console.error(error))
        .finally(() => {
          running = false;
        });
    }, 5000);
    timer.unref();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
