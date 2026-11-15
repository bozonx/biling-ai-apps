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
