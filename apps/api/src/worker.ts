import "reflect-metadata";
import "dotenv/config";
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
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(@Inject(WalletService) private readonly wallets: WalletService) {}
  onApplicationBootstrap() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 5000);
  }
  private tick() {
    if (this.running) return;
    this.running = this.wallets
      .expireHolds()
      .catch((error: unknown) => console.error(error))
      .finally(() => {
        this.running = undefined;
      });
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}
@Module({ providers: [Database, WalletService, HoldExpiryWorker] })
class WorkerModule {}
NestFactory.createApplicationContext(WorkerModule)
  .then((app) => app.enableShutdownHooks())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
