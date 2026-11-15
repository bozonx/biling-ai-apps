import { z } from "zod";
export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});
export type Health = z.infer<typeof healthSchema>;

const unsignedInteger = z.string().regex(/^(0|[1-9][0-9]{0,39})$/);
export const estimateRequestSchema = z
  .object({
    costNanoUsd: unsignedInteger,
    creditPriceUsdMicros: unsignedInteger.refine((value) => BigInt(value) > 0n),
  })
  .strict();
export const estimateResponseSchema = z.object({
  creditsMilli: unsignedInteger,
});

export const walletSchema = z.object({
  accountId: z.uuid(),
  productId: z.uuid(),
  balanceMilli: unsignedInteger,
  heldMilli: unsignedInteger,
  debtMilli: unsignedInteger,
});
export const operationSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  walletSeq: unsignedInteger,
  balanceAfterMilli: unsignedInteger,
  debtAfterMilli: unsignedInteger,
  createdAt: z.iso.datetime(),
});
export const operationsSchema = z.array(operationSchema);

export const accountContextSchema = z.object({
  accountId: z.uuid(),
  productId: z.uuid(),
});
export type AccountContext = z.infer<typeof accountContextSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type Operation = z.infer<typeof operationSchema>;

export const holdSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  productId: z.uuid(),
  amountMilli: unsignedInteger,
  committedMilli: unsignedInteger,
  status: z.enum(["open", "committed", "released", "expired"]),
  expiresAt: z.iso.datetime(),
});
export const entitlementsSchema = z.object({
  entitlements: z.record(
    z.string(),
    z.union([z.boolean(), z.number(), z.string()]),
  ),
});
export const usageSchema = z.array(
  z.object({
    id: z.uuid(),
    accountId: z.uuid(),
    productId: z.uuid(),
    creditsChargedMilli: unsignedInteger,
    costNanos: unsignedInteger.optional(),
    costSource: z.string().optional(),
    isLate: z.boolean().optional(),
    routeId: z.uuid().nullable().optional(),
    provider: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    routePriceVersionId: z.uuid().nullable().optional(),
    markupPolicyVersionId: z.uuid().nullable().optional(),
    creditRateVersionId: z.uuid().nullable().optional(),
    occurredAt: z.iso.datetime(),
    status: z.string(),
  }),
);
