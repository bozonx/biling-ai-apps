import { resolveLimits, type LimitRule } from "@billing/core";
import { z } from "zod";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { resolveEntitlements, type EntitlementValue } from "@billing/core";
import type { Prisma } from "./generated/prisma/client.js";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConflictException({ code: "INVALID_ENTITLEMENT_CONFIGURATION" });
  return value as Record<string, unknown>;
}
export async function effectiveEntitlements(
  tx: Prisma.TransactionClient,
  accountId: string,
  productId: string,
) {
  const now = new Date();
  const product = await tx.product.findUnique({ where: { id: productId } });
  const account = await tx.billingAccount.findUnique({
    where: { id: accountId },
  });
  if (!product || !account)
    throw new NotFoundException({ code: "ACCOUNT_OR_PRODUCT_NOT_FOUND" });
  const definitions = await tx.productEntitlementKey.findMany({
    where: { productId },
  });
  const limitSources: LimitRule[][] = [];
  const limitSchema = z.object({
    scope: z.enum(["account", "actor"]),
    window: z.enum(["minute", "hour", "day", "month"]),
    meter: z.enum(["credits", "requests", "cost_nanos"]),
    max: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
    feature: z.string().optional(),
  });
  const sources: { values: Record<string, unknown>; readOnly?: boolean }[] = [];
  if (account.status === "active" && product.status === "active") {
    const subscriptions = await tx.subscription.findMany({
      where: {
        accountId,
        status: { in: ["active", "trialing", "past_due", "read_only"] },
        currentPeriodStart: { lte: now },
        endedAt: null,
      },
      include: { planVersion: { include: { plan: true } } },
    });
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
    for (const source of [...subscriptions, ...grants]) {
      const version =
        source.planVersion ??
        ("planId" in source && source.planId
          ? await tx.planVersion.findFirst({
              where: {
                planId: source.planId,
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
        version.revokedAt ||
        version.effectiveFrom > now ||
        version.plan.kind === "addon" ||
        !version.plan.productScope.includes(product.code)
      )
        continue;
      const rawLimits = object(version.limits)[product.code];
      if (rawLimits !== undefined)
        limitSources.push(z.array(limitSchema).parse(rawLimits));
      const values = object(version.entitlements)[product.code];
      if (values !== undefined)
        sources.push({
          values: object(values),
          readOnly: source.status === "read_only",
        });
    }
  }
  const overrides =
    account.status === "active" && product.status === "active"
      ? await tx.entitlementOverride.findMany({
          where: {
            accountId,
            productId,
            targetKind: "entitlement",
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : [];
  let values: Record<string, EntitlementValue>;
  try {
    values = resolveEntitlements(definitions, sources, overrides);
  } catch {
    throw new ConflictException({ code: "INVALID_ENTITLEMENT_CONFIGURATION" });
  }
  const limitOverrides = await tx.limitOverride.findMany({
    where: {
      accountId,
      productId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const limits = resolveLimits(
    limitSources,
    limitOverrides.map((override) => limitSchema.parse(override.rule)),
  );
  return { definitions, values, limits };
}
