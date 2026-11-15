import { isDeepStrictEqual } from "node:util";
import { priceUsage, type MeteredUsage } from "./metering.js";
import { reserveLimits, closeLimits } from "./limits.js";
import { accrueGrants } from "./accrual.js";
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
    await tx.$queryRaw`SELECT "id" FROM "BillingAccount" WHERE "id" = ${accountId}::uuid FOR UPDATE`;
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

  private async expireBuckets(
    tx: Transaction,
    accountId: string,
    productId: string,
  ) {
    const now = new Date();
    let wallet = await tx.creditWallet.findUniqueOrThrow({
      where: { accountId_productId: { accountId, productId } },
    });
    const buckets = await tx.creditBucket.findMany({
      where: { accountId, productId, expiredAt: null, expiresAt: { lte: now } },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    });
    for (const bucket of buckets) {
      if (bucket.remainingMilli > 0n) {
        const operation = await tx.creditOperation.create({
          data: {
            accountId,
            productId,
            kind: "expiry",
            operationKey: `expiry:${bucket.id}`,
            walletSeq: wallet.lastOperationSeq + 1n,
            balanceAfterMilli: wallet.balanceMilli - bucket.remainingMilli,
            debtAfterMilli: wallet.debtMilli,
          },
        });
        await tx.creditLedgerEntry.create({
          data: {
            accountId,
            productId,
            operationId: operation.id,
            bucketId: bucket.id,
            amountMilli: -bucket.remainingMilli,
            reason: "expiry",
          },
        });
        wallet = await tx.creditWallet.update({
          where: { accountId_productId: { accountId, productId } },
          data: {
            balanceMilli: { decrement: bucket.remainingMilli },
            lastOperationSeq: { increment: 1 },
            version: { increment: 1 },
          },
        });
      }
      await tx.creditBucket.update({
        where: { id: bucket.id },
        data: { remainingMilli: 0n, expiredAt: now },
      });
    }
    const next = await tx.creditBucket.findFirst({
      where: {
        accountId,
        productId,
        expiredAt: null,
        remainingMilli: { gt: 0n },
        expiresAt: { not: null },
      },
      orderBy: { expiresAt: "asc" },
    });
    return tx.creditWallet.update({
      where: { accountId_productId: { accountId, productId } },
      data: { nextExpiryAt: next?.expiresAt ?? null },
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

  async maintainWallets() {
    const now = new Date();
    const wallets = await this.db.creditWallet.findMany({
      where: {
        OR: [{ nextAccrualAt: { lte: now } }, { nextExpiryAt: { lte: now } }],
      },
      orderBy: [{ accountId: "asc" }, { productId: "asc" }],
      take: 100,
    });
    for (const wallet of wallets) {
      await this.balance(wallet.accountId, wallet.productId);
    }
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
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, accountId, productId);
      await this.expireBuckets(tx, accountId, productId);
      await accrueGrants(tx, accountId, productId);
      return this.expireBuckets(tx, accountId, productId);
    });
  }

  async grant(
    productId: string,
    key: string,
    input: {
      accountId: string;
      amountMilli: string;
      creditRateVersionId: string;
    },
    actorIdentityId?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, input.accountId, productId);
      await this.expireBuckets(tx, input.accountId, productId);
      await accrueGrants(tx, input.accountId, productId);
      const wallet = await this.expireBuckets(tx, input.accountId, productId);
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
      if (actorIdentityId)
        await tx.adminAuditLog.create({
          data: {
            actorIdentityId,
            action: "credits.grant",
            targetType: "CreditOperation",
            targetId: operation.id,
            after: {
              accountId: input.accountId,
              productId,
              amountMilli: input.amountMilli,
            },
          },
        });
      return operation;
    });
  }

  async reserveMetered(
    productId: string,
    key: string,
    input: {
      accountId: string;
      featureId: string;
      routeId: string;
      meters: Record<string, string>;
      actorId?: string;
    },
  ) {
    const snapshot = await this.db.$transaction(async (tx) => {
      const access = await tx.productModelRoute.findUnique({
        where: { productId_routeId: { productId, routeId: input.routeId } },
      });
      if (!access?.isActive) fail("ROUTE_UNAVAILABLE");
      const rights = await effectiveEntitlements(
        tx,
        input.accountId,
        productId,
      );
      if (
        !satisfiesEntitlements(
          rights.definitions,
          rights.values,
          access!.requires as Record<string, unknown>,
        )
      )
        fail("ENTITLEMENT_DENIED");
      const feature = await tx.productFeature.findFirst({
        where: {
          id: input.featureId,
          productId,
          pricing: "metered",
          status: "active",
        },
      });
      if (!feature) fail("FEATURE_UNAVAILABLE");
      return priceUsage(tx, productId, input.routeId, input.meters, new Date());
    });
    const hold = await this.reserve(productId, key, {
      accountId: input.accountId,
      featureId: input.featureId,
      actorId: input.actorId,
      amountMilli: (snapshot.credits || 1n).toString(),
      estimatedCostNanos: snapshot.cost.toString(),
      routeId: input.routeId,
      routePriceVersionId: snapshot.price.id,
      creditRateVersionId: snapshot.rate.id,
      markupPolicyVersionId: snapshot.markup.id,
    });
    return { hold, route: snapshot.route };
  }

  async reserve(
    productId: string,
    key: string,
    input: {
      accountId: string;
      featureId: string;
      amountMilli: string;
      actorId?: string;
      estimatedCostNanos?: string;
      routeId?: string;
      routePriceVersionId?: string;
      creditRateVersionId?: string;
      markupPolicyVersionId?: string;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, input.accountId, productId);
      await this.expireBuckets(tx, input.accountId, productId);
      await accrueGrants(tx, input.accountId, productId);
      const wallet = await this.expireBuckets(tx, input.accountId, productId);
      const prior = await tx.creditHold.findUnique({
        where: { productId_idempotencyKey: { productId, idempotencyKey: key } },
      });
      if (prior) {
        if (
          prior.routeId !== (input.routeId ?? null) ||
          prior.accountId !== input.accountId ||
          prior.featureId !== input.featureId ||
          prior.actorId !== (input.actorId ?? null) ||
          prior.estimatedCostNanos !==
            (input.estimatedCostNanos === undefined
              ? null
              : BigInt(input.estimatedCostNanos)) ||
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
      const limitReservations = await reserveLimits(
        tx,
        productId,
        amount,
        input.accountId,
        input.featureId,
        entitlements.limits,
        input.actorId,
        feature.key,
        input.estimatedCostNanos === undefined
          ? undefined
          : BigInt(input.estimatedCostNanos),
      );
      const hold = await tx.creditHold.create({
        data: {
          ...input,
          amountMilli: amount,
          estimatedCostNanos:
            input.estimatedCostNanos === undefined
              ? null
              : BigInt(input.estimatedCostNanos),
          productId,
          idempotencyKey: key,
          limitReservations,
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
    actual?: { creditsMilli: bigint; costNanos: bigint },
    metered?: MeteredUsage,
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
      if (action === "commit" && hold.routeId && !metered)
        fail("METERED_USAGE_REQUIRED");
      const priced =
        metered && hold.routeId
          ? await priceUsage(
              tx,
              productId,
              hold.routeId,
              metered.meters,
              hold.createdAt,
              hold,
              metered.providerCostNanos,
            )
          : undefined;
      if (metered && !priced) fail("INVALID_METERED_HOLD");
      if (priced)
        actual = { creditsMilli: priced.credits, costNanos: priced.cost };
      const charged = actual?.creditsMilli ?? hold.amountMilli;
      if (
        actual &&
        (action !== "commit" ||
          charged < 0n ||
          (!metered && charged > hold.amountMilli) ||
          actual.costNanos < 0n)
      )
        fail("INVALID_ACTUAL_USAGE");
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
      if (hold.status === status) {
        if (action === "commit" && actual) {
          const previous = await tx.usageEvent.findFirst({
            where: { holdId: hold.id, productId },
          });
          if (
            !previous ||
            previous.creditsChargedMilli !== charged ||
            previous.costNanos !== actual.costNanos ||
            (metered && !isDeepStrictEqual(previous.meters, metered.meters))
          )
            fail("IDEMPOTENCY_CONFLICT");
        }
        return hold;
      }
      const late =
        action === "commit" &&
        (hold.status === "expired" ||
          hold.status === "released" ||
          hold.expiresAt <= new Date());
      if (
        hold.status !== "open" &&
        !(
          (hold.status === "expired" || hold.status === "released") &&
          late &&
          metered
        )
      )
        fail("HOLD_CLOSED");
      if (late && !metered) fail("HOLD_EXPIRED");
      const reserved = hold.status === "open" ? hold.amountMilli : 0n;
      let paid = charged;
      let debt = 0n;
      if (action === "commit") {
        const buckets = await tx.creditBucket.findMany({
          where: { accountId: hold.accountId, productId, expiredAt: null },
        });
        const availableBuckets = buckets
          .filter((b) => b.expiresAt === null || b.expiresAt > new Date())
          .reduce((sum, b) => sum + b.remainingMilli, 0n);
        const availableWallet =
          wallet.balanceMilli - wallet.heldMilli + reserved;
        const available =
          availableBuckets < availableWallet
            ? availableBuckets
            : availableWallet;
        if (!metered && available < charged) fail("CREDITS_EXPIRED");
        paid = charged < available ? charged : available > 0n ? available : 0n;
        debt = charged - paid;
        let allocations;
        try {
          allocations =
            paid === 0n ? [] : allocateCredits(buckets, paid, new Date());
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
            balanceAfterMilli: wallet.balanceMilli - paid,
            debtAfterMilli: wallet.debtMilli + debt,
          },
        });
        const usage = await tx.usageEvent.create({
          data: {
            accountId: hold.accountId,
            productId,
            featureId: hold.featureId!,
            holdId,
            operationId: operation.id,
            isLate: late,
            actorId: hold.actorId,
            routeId: hold.routeId,
            routePriceVersionId: hold.routePriceVersionId,
            creditRateVersionId: hold.creditRateVersionId,
            markupPolicyVersionId: hold.markupPolicyVersionId,
            provider: priced?.route.provider,
            model: priced?.route.model,
            meters: metered?.meters,
            inputTokens: BigInt(metered?.meters.input_tokens ?? "0"),
            outputTokens: BigInt(metered?.meters.output_tokens ?? "0"),
            rawUsage: metered?.rawUsage as Prisma.InputJsonObject | undefined,
            costSource:
              priced?.costSource ??
              (actual
                ? "provider"
                : hold.estimatedCostNanos === null
                  ? "unknown"
                  : "estimate"),
            costNanos: actual?.costNanos ?? hold.estimatedCostNanos ?? 0n,
            status: metered?.status ?? "ok",
            creditsChargedMilli: charged,
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
        if (debt > 0n)
          await tx.creditLedgerEntry.create({
            data: {
              accountId: hold.accountId,
              productId,
              operationId: operation.id,
              amountMilli: debt,
              reason: "debt",
              usageEventId: usage.id,
              holdId,
            },
          });
        if (late || charged > hold.amountMilli || debt > 0n)
          await tx.adminTask.upsert({
            where: { dedupeKey: `metering:${hold.id}` },
            update: {},
            create: {
              kind: "metering_discrepancy",
              dedupeKey: `metering:${hold.id}`,
              accountId: hold.accountId,
              details: {
                holdId: hold.id,
                isLate: late,
                reservedMilli: hold.amountMilli.toString(),
                chargedMilli: charged.toString(),
                debtMilli: debt.toString(),
              },
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
          heldMilli: { decrement: reserved },
          balanceMilli: {
            decrement: action === "commit" ? paid : 0n,
          },
          debtMilli: { increment: action === "commit" ? debt : 0n },
          lastOperationSeq: { increment: action === "commit" ? 1 : 0 },
          version: { increment: 1 },
        },
      });
      if (reserved > 0n || action === "commit")
        await closeLimits(
          tx,
          hold.limitReservations,
          action === "commit",
          actual
            ? { credits: charged, cost_nanos: actual.costNanos }
            : undefined,
          reserved > 0n,
        );
      return tx.creditHold.update({
        where: { id: holdId },
        data: {
          status,
          closedAt: new Date(),
          committedMilli: action === "commit" ? charged : 0n,
        },
      });
    });
  }
}
