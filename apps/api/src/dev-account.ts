import { Controller, Get, Inject, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { walletSchema, operationsSchema } from "@billing/contracts";
import { WalletService } from "./wallet.js";

@Controller("me")
export class DevAccountController {
  constructor(@Inject(WalletService) private readonly wallets: WalletService) {}
  private context() {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.DEV_ACCOUNT_ENABLED !== "true"
    )
      throw new NotFoundException();
    return {
      accountId: z.uuid().parse(process.env.DEV_ACCOUNT_ID),
      productId: z.uuid().parse(process.env.DEV_PRODUCT_ID),
    };
  }
  private json(value: unknown): unknown {
    return JSON.parse(
      JSON.stringify(value, (_key, item: unknown) =>
        typeof item === "bigint" ? item.toString() : item,
      ),
    );
  }
  @Get()
  account() {
    return this.context();
  }
  @Get("wallet")
  async wallet() {
    const { accountId, productId } = this.context();
    return walletSchema.parse(
      this.json(await this.wallets.balance(accountId, productId)),
    );
  }
  @Get("operations")
  async operations() {
    const { accountId, productId } = this.context();
    return operationsSchema.parse(
      this.json(await this.wallets.history(accountId, productId)),
    );
  }
}
