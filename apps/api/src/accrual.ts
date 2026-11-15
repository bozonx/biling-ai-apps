import { ConflictException } from "@nestjs/common";
import type { Prisma } from "./generated/prisma/client.js";

import { accrualBoundary as boundary, applyCreditGrant } from "@billing/core";

export async function accrueGrants(
  tx: Prisma.TransactionClient,
  accountId: string,
  productId: string,
) {
  const now = new Date();
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
  });
  const account = await tx.billingAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (product.status !== "active" || account.status !== "active") return;
  const grants = await tx.planGrant.findMany({
    where: {
      accountId,
      productId,
      status: "active",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    include: { planVersion: { include: { plan: true } } },
  });
  const subscriptions = await tx.subscription.findMany({
    where: {
      accountId,
      status: "active",
      endedAt: null,
      currentPeriodStart: { lte: now },
      currentPeriodEnd: { gt: now },
    },
    include: {
      planVersion: { include: { plan: true } },
      payments: {
        where: { status: "succeeded", refundedMicros: 0n },
      },
    },
  });
  const sources = [
    ...grants.map((grant) => ({
      ...grant,
      sourceType: "plan_grant" as const,
      keyPrefix: "grant",
      quantity: 1,
    })),
    ...subscriptions
      .filter((subscription) =>
        subscription.payments.some(
          (payment) =>
            payment.accountId === accountId &&
            payment.planVersionId === subscription.planVersionId &&
            payment.periodStart &&
            payment.periodStart <= subscription.currentPeriodStart &&
            payment.periodEnd &&
            payment.periodEnd >= subscription.currentPeriodEnd,
        ),
      )
      .map((subscription) => ({
        id: subscription.id,
        planVersion: subscription.planVersion,
        planId: null,
        startsAt: subscription.currentPeriodStart,
        endsAt: subscription.currentPeriodEnd,
        sourceType: "subscription" as const,
        keyPrefix: "sub",
        quantity: subscription.quantity,
      })),
  ];
  let nextAccrualAt: Date | null = null;
  for (const grant of sources) {
    const version =
      grant.planVersion ??
      (grant.planId
        ? await tx.planVersion.findFirst({
            where: {
              planId: grant.planId,
              publishedAt: { not: null },
              revokedAt: null,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
            orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
            include: { plan: true },
          })
        : null);
    if (
      !version ||
      !version.publishedAt ||
      version.effectiveFrom > now ||
      !version.plan.productScope.includes(product.code)
    )
      continue;
    const count = version.creditGrantIntervalCount;
    if (count < 1)
      throw new ConflictException({ code: "INVALID_ACCRUAL_CONFIGURATION" });
    let index = 0;
    // Binary search avoids iterating over missed periods for dormant accounts.
    let high = 1;
    while (
      boundary(grant.startsAt, version.creditGrantInterval, count, high) <= now
    )
      high *= 2;
    while (index + 1 < high) {
      const mid = Math.floor((index + high) / 2);
      if (
        boundary(grant.startsAt, version.creditGrantInterval, count, mid) <= now
      )
        index = mid;
      else high = mid;
    }
    const start = boundary(
      grant.startsAt,
      version.creditGrantInterval,
      count,
      index,
    );
    const fullEnd = boundary(
      grant.startsAt,
      version.creditGrantInterval,
      count,
      index + 1,
    );
    const end = grant.endsAt && grant.endsAt < fullEnd ? grant.endsAt : fullEnd;
    if (!nextAccrualAt || end < nextAccrualAt) nextAccrualAt = end;
    if (
      !version.creditGrants ||
      typeof version.creditGrants !== "object" ||
      Array.isArray(version.creditGrants)
    )
      throw new ConflictException({ code: "INVALID_ACCRUAL_CONFIGURATION" });
    const values = version.creditGrants as Record<string, unknown>;
    const value = values[product.code];
    if (value === undefined || value === 0 || value === "0") continue;
    if (
      !(typeof value === "string" && /^[1-9][0-9]*$/.test(value)) &&
      !(typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    )
      throw new ConflictException({ code: "INVALID_ACCRUAL_CONFIGURATION" });
    const amount =
      (BigInt(value as string | number) *
        BigInt(grant.quantity) *
        BigInt(end.getTime() - start.getTime())) /
      BigInt(fullEnd.getTime() - start.getTime());
    if (amount === 0n) continue;
    const operationKey = `accrual:${grant.keyPrefix}:${grant.id}:${start.toISOString()}:${version.id}`;
    if (
      await tx.creditOperation.findUnique({
        where: { productId_operationKey: { productId, operationKey } },
      })
    )
      continue;
    const rate = await tx.creditRateVersion.findFirst({
      where: {
        productId,
        publishedAt: { not: null },
        effectiveFrom: { lte: now },
      },
      orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
    });
    if (!rate) throw new ConflictException({ code: "INVALID_CREDIT_RATE" });
    const wallet = await tx.creditWallet.findUniqueOrThrow({
      where: { accountId_productId: { accountId, productId } },
    });
    const { repayment, available } = applyCreditGrant(amount, wallet.debtMilli);
    if (available > 9223372036854775807n - wallet.balanceMilli)
      throw new ConflictException({ code: "AMOUNT_OUT_OF_RANGE" });
    const operation = await tx.creditOperation.create({
      data: {
        accountId,
        productId,
        kind: "accrual",
        operationKey,
        walletSeq: wallet.lastOperationSeq + 1n,
        balanceAfterMilli: wallet.balanceMilli + available,
        debtAfterMilli: wallet.debtMilli - repayment,
      },
    });
    const bucket = await tx.creditBucket.create({
      data: {
        accountId,
        productId,
        kind: "plan",
        grantedMilli: amount,
        remainingMilli: available,
        expiresAt: end,
        creditRateVersionId: rate.id,
        sourceType: grant.sourceType,
        sourceId: grant.id,
        periodStart: start,
        operationId: operation.id,
      },
    });
    await tx.creditLedgerEntry.create({
      data: {
        accountId,
        productId,
        operationId: operation.id,
        bucketId: bucket.id,
        amountMilli: amount,
        reason: "accrual",
      },
    });
    if (repayment > 0n) {
      await tx.creditLedgerEntry.createMany({
        data: [
          {
            accountId,
            productId,
            operationId: operation.id,
            bucketId: bucket.id,
            amountMilli: -repayment,
            reason: "debt_repayment",
          },
          {
            accountId,
            productId,
            operationId: operation.id,
            amountMilli: -repayment,
            reason: "debt",
          },
        ],
      });
    }
    await tx.creditWallet.update({
      where: { accountId_productId: { accountId, productId } },
      data: {
        balanceMilli: { increment: available },
        debtMilli: { decrement: repayment },
        lastOperationSeq: { increment: 1 },
        version: { increment: 1 },
      },
    });
  }
  await tx.creditWallet.update({
    where: { accountId_productId: { accountId, productId } },
    data: { nextAccrualAt },
  });
}
