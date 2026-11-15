/** Integer units only: 1000 milli-credits = 1 credit. */
export function displayCredits(milliCredits: bigint): bigint {
  if (milliCredits < 0n) throw new RangeError("Balance must be non-negative");
  return milliCredits / 1000n;
}
