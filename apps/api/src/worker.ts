import { logger, nestLogger } from "./logging.js";
import "reflect-metadata";
import "dotenv/config";
import { config } from "./config.js";
import { startMaintenanceQueue } from "./maintenance-queue.js";
import { NestFactory } from "@nestjs/core";
import { Database } from "./database.js";
import { WalletService } from "./wallet.js";
import {
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";

@Injectable()
class HoldExpiryWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private close?: () => Promise<void>;
  constructor(@Inject(WalletService) private readonly wallets: WalletService) {}
  async onApplicationBootstrap() {
    this.close = await startMaintenanceQueue(
      { host: config.REDIS_HOST, port: config.REDIS_PORT },
      async () => {
        await this.wallets.expireHolds();
        await this.wallets.maintainWallets();
      },
      (error) =>
        logger.error({ errorType: error.name }, "Maintenance job failed"),
    );
  }
  async onModuleDestroy() {
    await this.close?.();
  }
}
@Module({ providers: [Database, WalletService, HoldExpiryWorker] })
class WorkerModule {}
NestFactory.createApplicationContext(WorkerModule, { logger: nestLogger })
  .then((app) => app.enableShutdownHooks())
  .catch((error: unknown) => {
    logger.error(
      { errorType: error instanceof Error ? error.name : "Unknown" },
      "Worker startup failed",
    );
    process.exit(1);
  });
