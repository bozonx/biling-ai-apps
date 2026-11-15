/** Round positive rational amounts up without floating point arithmetic. */
export function ceilDivide(value: bigint, divisor: bigint): bigint {
  if (value < 0n || divisor <= 0n) throw new RangeError("Invalid ratio");
  return (value + divisor - 1n) / divisor;
}

/** USD nano cost / USD micro per credit, expressed in milli-credits. */
export function estimateCredits(
  costNanoUsd: bigint,
  creditPriceUsdMicros: bigint,
): bigint {
  return ceilDivide(costNanoUsd, creditPriceUsdMicros);
}

export interface SpendBucket {
  id: string;
  remainingMilli: bigint;
  expiresAt: Date | null;
}

/** Consume expiring buckets first; equal expiry is ordered by stable bucket id. */
export function allocateCredits(
  buckets: readonly SpendBucket[],
  amountMilli: bigint,
  now: Date,
) {
  if (amountMilli <= 0n) throw new RangeError("Amount must be positive");
  if (new Set(buckets.map((bucket) => bucket.id)).size !== buckets.length)
    throw new RangeError("Duplicate bucket");
  const eligible = buckets
    .filter((bucket) => {
      if (bucket.remainingMilli < 0n)
        throw new RangeError("Invalid bucket balance");
      return bucket.expiresAt === null || bucket.expiresAt > now;
    })
    .sort((a, b) => {
      const left = a.expiresAt?.getTime() ?? Infinity;
      const right = b.expiresAt?.getTime() ?? Infinity;
      return left === right ? a.id.localeCompare(b.id) : left < right ? -1 : 1;
    });
  let remaining = amountMilli;
  const allocations: { bucketId: string; amountMilli: bigint }[] = [];
  for (const bucket of eligible) {
    const amount =
      bucket.remainingMilli < remaining ? bucket.remainingMilli : remaining;
    if (amount > 0n)
      allocations.push({ bucketId: bucket.id, amountMilli: amount });
    remaining -= amount;
    if (remaining === 0n) return allocations;
  }
  throw new RangeError("Insufficient credits");
}
