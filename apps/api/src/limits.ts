import { limitWindow, type LimitRule } from "@billing/core";
import { HttpException } from "@nestjs/common";
import type { Prisma } from "./generated/prisma/client.js";

type Reservation = {
  scopeKey: string;
  windowStart: string;
  meter: "requests" | "credits" | "cost_nanos";
  amount: string;
};

export async function reserveLimits(
  tx: Prisma.TransactionClient,
  productId: string,
  amount: bigint,
  accountId: string,
  featureId: string,
  rules: LimitRule[],
  actorId?: string,
  featureKey?: string,
  estimatedCostNanos?: bigint,
) {
  const policies = await tx.limitPolicy.findMany({
    where: {
      isActive: true,
      OR: [{ scope: "deployment" }, { scope: "product", productId }],
    },
    orderBy: { id: "asc" },
  });
  const clientPolicies = rules
    .filter(
      (rule) =>
        !rule.feature ||
        rule.feature === featureId ||
        rule.feature === featureKey,
    )
    .map((rule) => {
      if (rule.scope === "actor" && !actorId)
        throw new HttpException({ code: "ACTOR_REQUIRED" }, 409);
      return {
        ...rule,
        id: `${rule.scope}:${accountId}:${rule.scope === "actor" ? actorId : "*"}:${productId}:${rule.window}:${rule.meter}:${rule.feature ?? "*"}`,
        max: BigInt(rule.max),
      };
    });
  const reservations: Reservation[] = [];
  for (const policy of [...policies, ...clientPolicies]) {
    // Lock shared policies across wallets before checking their durable counters.
    if (policy.scope !== "account" && policy.scope !== "actor")
      await tx.$queryRaw`SELECT id FROM "LimitPolicy" WHERE id = ${policy.id}::uuid FOR UPDATE`;
    if (policy.meter === "cost_nanos" && estimatedCostNanos === undefined)
      throw new HttpException({ code: "COST_ESTIMATE_REQUIRED" }, 409);
    const { start, end } = limitWindow(policy.window, new Date());
    const scopeKey = `policy:${policy.id}`;
    const key = { scopeKey, windowStart: start, meter: policy.meter };
    const row = await tx.limitUsageWindow.upsert({
      where: { scopeKey_windowStart_meter: key },
      create: { ...key, windowEnd: end },
      update: {},
    });
    const value =
      policy.meter === "requests"
        ? 1n
        : policy.meter === "cost_nanos"
          ? estimatedCostNanos!
          : amount;
    if (row.consumed + row.reserved + value > policy.max)
      throw new HttpException({ code: "LIMIT_EXCEEDED" }, 429);
    await tx.limitUsageWindow.update({
      where: { scopeKey_windowStart_meter: key },
      data: { reserved: { increment: value } },
    });
    reservations.push({
      scopeKey,
      windowStart: start.toISOString(),
      meter: policy.meter,
      amount: value.toString(),
    });
  }
  return reservations;
}

export async function closeLimits(
  tx: Prisma.TransactionClient,
  value: Prisma.JsonValue,
  commit: boolean,
  actual?: { credits: bigint; cost_nanos: bigint },
) {
  for (const reservation of value as Reservation[]) {
    await tx.limitUsageWindow.update({
      where: {
        scopeKey_windowStart_meter: {
          scopeKey: reservation.scopeKey,
          windowStart: new Date(reservation.windowStart),
          meter: reservation.meter,
        },
      },
      data: {
        reserved: { decrement: BigInt(reservation.amount) },
        consumed: {
          increment: commit
            ? reservation.meter === "requests"
              ? BigInt(reservation.amount)
              : (actual?.[reservation.meter] ?? BigInt(reservation.amount))
            : 0n,
        },
      },
    });
  }
}
