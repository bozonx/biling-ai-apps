import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Database } from "./database.js";
import type { Prisma } from "./generated/prisma/client.js";
import { allocateCredits } from "@billing/core";

type Transaction = Prisma.TransactionClient;
const fail = (code: string): never => {
  throw new ConflictException({ code });
};

@Injectable()
export class WalletService {
  constructor(@Inject(Database) private readonly db: Database) {}

  private async lock(tx: Transaction, accountId: string, productId: string) {
    await tx.creditWallet.upsert({
      where: { accountId_productId: { accountId, productId } },
      create: { accountId, productId },
      update: {},
    });
    await tx.$queryRaw`SELECT "accountId" FROM "CreditWallet" WHERE "accountId" = ${accountId}::uuid AND "productId" = ${productId}::uuid FOR UPDATE`;
    return tx.creditWallet.findUniqueOrThrow({
      where: { accountId_productId: { accountId, productId } },
    });
  }

  async balance(accountId: string, productId: string) {
    const wallet = await this.db.creditWallet.findUnique({
      where: { accountId_productId: { accountId, productId } },
    });
    if (!wallet) throw new NotFoundException({ code: "WALLET_NOT_FOUND" });
    return wallet;
  }

  async grant(
    productId: string,
    key: string,
    input: {
      accountId: string;
      amountMilli: string;
      creditRateVersionId: string;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      const wallet = await this.lock(tx, input.accountId, productId);
      const prior = await tx.creditOperation.findUnique({
        where: { productId_operationKey: { productId, operationKey: key } },
      });
      if (prior) {
        if (
          prior.accountId !== input.accountId ||
          JSON.stringify(prior.meta) !== JSON.stringify(input)
        )
          fail("IDEMPOTENCY_CONFLICT");
        return prior;
      }
      const rate = await tx.creditRateVersion.findFirst({
        where: {
          id: input.creditRateVersionId,
          productId,
          publishedAt: { not: null },
          effectiveFrom: { lte: new Date() },
        },
      });
      if (!rate) fail("INVALID_CREDIT_RATE");
      if (wallet.debtMilli > 0n) fail("DEBT_REPAYMENT_REQUIRED");
      const amount = BigInt(input.amountMilli);
      const operation = await tx.creditOperation.create({
        data: {
          accountId: input.accountId,
          productId,
          kind: "grant",
          operationKey: key,
          walletSeq: wallet.lastOperationSeq + 1n,
          balanceAfterMilli: wallet.balanceMilli + amount,
          debtAfterMilli: wallet.debtMilli,
          meta: input,
        },
      });
      const bucket = await tx.creditBucket.create({
        data: {
          accountId: input.accountId,
          productId,
          kind: "compensation",
          grantedMilli: amount,
          remainingMilli: amount,
          creditRateVersionId: input.creditRateVersionId,
          sourceType: "manual",
          sourceId: operation.id,
          operationId: operation.id,
        },
      });
      await tx.creditLedgerEntry.create({
        data: {
          accountId: input.accountId,
          productId,
          operationId: operation.id,
          bucketId: bucket.id,
          amountMilli: amount,
          reason: "adjustment",
        },
      });
      await tx.creditWallet.update({
        where: {
          accountId_productId: { accountId: input.accountId, productId },
        },
        data: {
          balanceMilli: { increment: amount },
          lastOperationSeq: { increment: 1 },
          version: { increment: 1 },
        },
      });
      return operation;
    });
  }

  async reserve(
    productId: string,
    key: string,
    input: { accountId: string; featureId: string; amountMilli: string },
  ) {
    return this.db.$transaction(async (tx) => {
      const wallet = await this.lock(tx, input.accountId, productId);
      const prior = await tx.creditHold.findUnique({
        where: { productId_idempotencyKey: { productId, idempotencyKey: key } },
      });
      if (prior) {
        if (
          prior.accountId !== input.accountId ||
          prior.featureId !== input.featureId ||
          prior.amountMilli !== BigInt(input.amountMilli)
        )
          fail("IDEMPOTENCY_CONFLICT");
        return prior;
      }
      const feature = await tx.productFeature.findFirst({
        where: { id: input.featureId, productId, status: "active" },
      });
      if (!feature)
        throw new ConflictException({ code: "FEATURE_UNAVAILABLE" });
      // Entitlement-bearing features are denied until entitlement resolution is implemented.
      if (Object.keys(feature.requires as object).length)
        fail("ENTITLEMENTS_REQUIRED");
      const account = await tx.billingAccount.findUniqueOrThrow({
        where: { id: input.accountId },
      });
      if (account.status !== "active") fail("ACCOUNT_INACTIVE");
      const amount = BigInt(input.amountMilli);
      if (
        wallet.debtMilli > 0n ||
        wallet.balanceMilli - wallet.heldMilli < amount
      )
        fail("INSUFFICIENT_CREDITS");
      const hold = await tx.creditHold.create({
        data: {
          ...input,
          amountMilli: amount,
          productId,
          idempotencyKey: key,
          expiresAt: new Date(Date.now() + feature.defaultHoldTtlSec * 1000),
        },
      });
      await tx.creditWallet.update({
        where: {
          accountId_productId: { accountId: input.accountId, productId },
        },
        data: { heldMilli: { increment: amount }, version: { increment: 1 } },
      });
      return hold;
    });
  }

  async close(productId: string, holdId: string, action: "commit" | "release") {
    return this.db.$transaction(async (tx) => {
      const initial = await tx.creditHold.findFirst({
        where: { id: holdId, productId },
      });
      if (!initial) throw new NotFoundException({ code: "HOLD_NOT_FOUND" });
      const wallet = await this.lock(tx, initial.accountId, productId);
      const hold = await tx.creditHold.findUniqueOrThrow({
        where: { id: holdId },
      });
      const status = action === "commit" ? "committed" : "released";
      if (hold.status === status) return hold;
      if (hold.status !== "open") fail("HOLD_CLOSED");
      if (action === "commit" && hold.expiresAt <= new Date())
        fail("HOLD_EXPIRED");
      if (action === "commit") {
        const buckets = await tx.creditBucket.findMany({
          where: { accountId: hold.accountId, productId, expiredAt: null },
        });
        const allocations = allocateCredits(
          buckets,
          hold.amountMilli,
          new Date(),
        );
        const operation = await tx.creditOperation.create({
          data: {
            accountId: hold.accountId,
            productId,
            kind: "commit",
            operationKey: `commit:${hold.id}`,
            walletSeq: wallet.lastOperationSeq + 1n,
            balanceAfterMilli: wallet.balanceMilli - hold.amountMilli,
            debtAfterMilli: wallet.debtMilli,
          },
        });
        for (const allocation of allocations) {
          await tx.creditBucket.update({
            where: { id: allocation.bucketId },
            data: { remainingMilli: { decrement: allocation.amountMilli } },
          });
          await tx.creditLedgerEntry.create({
            data: {
              accountId: hold.accountId,
              productId,
              operationId: operation.id,
              bucketId: allocation.bucketId,
              amountMilli: -allocation.amountMilli,
              reason: "consumption",
              holdId,
            },
          });
        }
      }
      await tx.creditWallet.update({
        where: {
          accountId_productId: { accountId: hold.accountId, productId },
        },
        data: {
          heldMilli: { decrement: hold.amountMilli },
          balanceMilli: {
            decrement: action === "commit" ? hold.amountMilli : 0n,
          },
          lastOperationSeq: { increment: action === "commit" ? 1 : 0 },
          version: { increment: 1 },
        },
      });
      return tx.creditHold.update({
        where: { id: holdId },
        data: {
          status,
          closedAt: new Date(),
          committedMilli: action === "commit" ? hold.amountMilli : 0n,
        },
      });
    });
  }
}
