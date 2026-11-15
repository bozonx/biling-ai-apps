import { ConflictException } from "@nestjs/common";
import { ceilDivide } from "@billing/core";
import { z } from "zod";
import type { Prisma } from "./generated/prisma/client.js";

export const meterAmount = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
export const metersSchema = z.record(z.string().min(1).max(80), meterAmount);
export const tiersSchema = z
  .array(
    z
      .object({
        fromCostNanos: meterAmount,
        multiplierBps: z.number().int().min(10000).max(1000000),
      })
      .strict(),
  )
  .min(1)
  .refine(
    (t) =>
      t[0]?.fromCostNanos === "0" &&
      t.every(
        (v, i) =>
          i === 0 || BigInt(v.fromCostNanos) > BigInt(t[i - 1]!.fromCostNanos),
      ),
  );
export const meteredUsageSchema = z
  .object({
    meters: metersSchema,
    providerCostNanos: meterAmount.optional(),
    rawUsage: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["ok", "partial"]).default("ok"),
  })
  .strict();
export type MeteredUsage = z.infer<typeof meteredUsageSchema>;
export function routeCost(
  items: {
    meter: string;
    unitNanos: bigint;
    per: bigint;
    minBillableUnits: bigint | null;
    tier: unknown;
  }[],
  meters: Record<string, string>,
) {
  let cost = 0n;
  for (const meter of Object.keys(meters))
    if (!items.some((i) => i.meter === meter) && BigInt(meters[meter]!) > 0n)
      throw new ConflictException({ code: "UNPRICED_METER" });
  for (const meter of new Set(items.map((i) => i.meter))) {
    const context =
      BigInt(meters.input_tokens ?? "0") +
      BigInt(meters.cached_input_tokens ?? "0");
    const candidates = items
      .filter((i) => i.meter === meter)
      .map((i) => ({
        item: i,
        from: i.tier
          ? BigInt(
              z
                .object({ fromContextTokens: z.number().int().nonnegative() })
                .parse(i.tier).fromContextTokens,
            )
          : 0n,
      }))
      .filter((i) => i.from <= context)
      .sort((a, b) => (a.from > b.from ? -1 : a.from < b.from ? 1 : 0));
    const item = candidates[0]?.item;
    const units = BigInt(meters[meter] ?? "0");
    if (units === 0n) continue;
    if (!item) throw new ConflictException({ code: "UNPRICED_METER" });
    cost += ceilDivide(
      (units < (item.minBillableUnits ?? 0n) ? item.minBillableUnits! : units) *
        item.unitNanos,
      item.per,
    );
  }
  return cost;
}
export async function priceUsage(
  tx: Prisma.TransactionClient,
  productId: string,
  routeId: string,
  meters: Record<string, string>,
  at: Date,
  pinned?: {
    routePriceVersionId: string | null;
    creditRateVersionId: string | null;
    markupPolicyVersionId: string | null;
  },
  providerCostNanos?: string,
) {
  const active = { publishedAt: { not: null }, effectiveFrom: { lte: at } };
  const [route, price, rate, markup] = await Promise.all([
    tx.modelRoute.findUniqueOrThrow({ where: { id: routeId } }),
    tx.routePriceVersion.findFirst({
      where: pinned
        ? { id: pinned.routePriceVersionId ?? "", routeId }
        : { routeId, ...active },
      orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
      include: { items: true },
    }),
    tx.creditRateVersion.findFirst({
      where: pinned
        ? { id: pinned.creditRateVersionId ?? "", productId }
        : { productId, ...active },
      orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
    }),
    tx.markupPolicyVersion.findFirst({
      where: pinned
        ? { id: pinned.markupPolicyVersionId ?? "", productId }
        : { productId, ...active },
      orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
    }),
  ]);
  if (!price || !rate || !markup)
    throw new ConflictException({ code: "PRICING_UNAVAILABLE" });
  if (providerCostNanos !== undefined && route.provider !== "openrouter")
    throw new ConflictException({ code: "INVALID_PROVIDER_COST" });
  if (
    pinned &&
    route.provider === "openrouter" &&
    providerCostNanos === undefined
  )
    throw new ConflictException({ code: "MISSING_PROVIDER_COST" });
  const cost =
    providerCostNanos === undefined
      ? routeCost(price.items, meters)
      : BigInt(providerCostNanos);
  const tiers = tiersSchema.parse(markup.tiers);
  const tier = [...tiers]
    .reverse()
    .find((t) => cost >= BigInt(t.fromCostNanos))!;
  const computed = ceilDivide(
    cost * BigInt(tier.multiplierBps),
    rate.creditValueMicros * 10000n,
  );
  const credits =
    computed < (markup.minChargeMilli ?? 0n)
      ? markup.minChargeMilli!
      : computed;
  if (cost > 9223372036854775807n || credits > 9223372036854775807n)
    throw new ConflictException({ code: "PRICING_OVERFLOW" });
  return {
    cost,
    credits,
    route,
    price,
    rate,
    markup,
    costSource: providerCostNanos === undefined ? "price_table" : "provider",
  };
}
