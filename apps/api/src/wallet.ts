import { effectiveEntitlements } from "./entitlements.js";
import { satisfiesEntitlements } from "@billing/core";
import {
  ConflictException,
  HttpException,
  Logger,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Database } from "./database.js";
import type { Prisma } from "./generated/prisma/client.js";
import { allocateCredits } from "@billing/core";

type Transaction = Prisma.TransactionClient;
const fail = (code: string): never => {
  throw new HttpException(
    { code },
    code === "INSUFFICIENT_CREDITS" ? 402 : 409,
  );
};

@Injectable()
export class WalletService {
  constructor(@Inject(Database) private readonly db: Database) {}

  private async lock(tx: Transaction, accountId: string, productId: string) {
    const account = await tx.billingAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException({ code: "ACCOUNT_NOT_FOUND" });
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

  private sameGrant(
    meta: unknown,
    input: {
      accountId: string;
      amountMilli: string;
      creditRateVersionId: string;
    },
  ) {
    if (!meta || typeof meta !== "object") return false;
    const value = meta as Record<string, unknown>;
    return (
      value.accountId === input.accountId &&
      value.amountMilli === input.amountMilli &&
      value.creditRateVersionId === input.creditRateVersionId
    );
  }

  async entitlements(accountId: string, productId: string) {
    return this.db.$transaction(
      async (tx) =>
        (await effectiveEntitlements(tx, accountId, productId)).values,
      { isolationLevel: "RepeatableRead" },
    );
  }

  async expireHolds() {
    const holds = await this.db.creditHold.findMany({
      where: { status: "open", expiresAt: { lte: new Date() } },
      take: 100,
    });
    for (const hold of holds) {
      try {
        await this.close(hold.productId, hold.id, "expire");
      } catch (error) {
        Logger.error(error, undefined, "HoldExpiry");
      }
    }
  }

  async usage(accountId: string, productId: string, before?: string) {
    return this.db.usageEvent.findMany({
      where: {
        accountId,
        productId,
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { id: "desc" },
      take: 50,
    });
  }

  async history(accountId: string, productId: string, before?: string) {
    return this.db.creditOperation.findMany({
      where: {
        accountId,
        productId,
        ...(before ? { walletSeq: { lt: BigInt(before) } } : {}),
      },
      orderBy: { walletSeq: "desc" },
      take: 50,
    });
  }

  async balance(accountId: string, productId: string) {
    const wallet = await this.db.creditWallet.findUnique({
      where: { accountId_productId: { accountId, productId } },
    });
    if (!wallet)
      return {
        accountId,
        productId,
        balanceMilli: 0n,
        heldMilli: 0n,
        debtMilli: 0n,
      };
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
          !this.sameGrant(prior.meta, input)
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
      if (amount > 9223372036854775807n - wallet.balanceMilli)
        fail("AMOUNT_OUT_OF_RANGE");
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
      const entitlements = await effectiveEntitlements(
        tx,
        input.accountId,
        productId,
      );
      if (
        !satisfiesEntitlements(
          entitlements.definitions,
          entitlements.values,
          feature.requires as Record<string, unknown>,
        )
      )
        throw new HttpException({ code: "ENTITLEMENT_DENIED" }, 403);
      const account = await tx.billingAccount.findUniqueOrThrow({
        where: { id: input.accountId },
      });
      if (account.status !== "active") fail("ACCOUNT_INACTIVE");
      const amount = BigInt(input.amountMilli);
      const buckets = await tx.creditBucket.findMany({
        where: {
          accountId: input.accountId,
          productId,
          expiredAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      const spendable = buckets.reduce(
        (sum, bucket) => sum + bucket.remainingMilli,
        0n,
      );
      if (
        spendable - wallet.heldMilli < amount ||
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

  async close(
    productId: string,
    holdId: string,
    action: "commit" | "release" | "expire",
  ) {
    return this.db.$transaction(async (tx) => {
      const initial = await tx.creditHold.findFirst({
        where: { id: holdId, productId },
      });
      if (!initial) throw new NotFoundException({ code: "HOLD_NOT_FOUND" });
      const wallet = await this.lock(tx, initial.accountId, productId);
      const hold = await tx.creditHold.findUniqueOrThrow({
        where: { id: holdId },
      });
      const status =
        action === "commit"
          ? "committed"
          : action === "expire"
            ? "expired"
            : "released";
      if (
        action === "expire" &&
        (hold.status !== "open" || hold.expiresAt > new Date())
      )
        return hold;
      if (hold.status === status) return hold;
      if (hold.status !== "open") fail("HOLD_CLOSED");
      if (action === "commit" && hold.expiresAt <= new Date())
        fail("HOLD_EXPIRED");
      if (action === "commit") {
        const buckets = await tx.creditBucket.findMany({
          where: { accountId: hold.accountId, productId, expiredAt: null },
        });
        let allocations;
        try {
          allocations = allocateCredits(buckets, hold.amountMilli, new Date());
        } catch (error) {
          if (
            error instanceof RangeError &&
            error.message === "Insufficient credits"
          )
            fail("CREDITS_EXPIRED");
          throw error;
        }
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
        const usage = await tx.usageEvent.create({
          data: {
            accountId: hold.accountId,
            productId,
            featureId: hold.featureId!,
            holdId,
            operationId: operation.id,
            costSource: "unknown",
            status: "ok",
            creditsChargedMilli: hold.amountMilli,
            idempotencyKey: `commit:${hold.id}`,
            occurredAt: new Date(),
          },
        });
        await tx.usageEventKey.create({
          data: {
            productId,
            idempotencyKey: usage.idempotencyKey,
            usageEventId: usage.id,
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
              usageEventId: usage.id,
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
