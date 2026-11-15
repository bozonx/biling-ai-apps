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
