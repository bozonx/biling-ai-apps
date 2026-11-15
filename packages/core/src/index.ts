/** Integer units only: 1000 milli-credits = 1 credit. */
export function displayCredits(milliCredits: bigint): bigint {
  if (milliCredits < 0n) throw new RangeError("Balance must be non-negative");
  return milliCredits / 1000n;
}
export { ceilDivide, estimateCredits, allocateCredits } from "./billing.js";
export type { SpendBucket } from "./billing.js";
export { resolveEntitlements, satisfiesEntitlements } from "./entitlements.js";
export type {
  EntitlementDefinition,
  EntitlementValue,
} from "./entitlements.js";

export { accrualBoundary } from "./accrual.js";
export { applyCreditGrant } from "./billing.js";
export { resolveLimits, limitWindow, type LimitRule } from "./limits.js";
