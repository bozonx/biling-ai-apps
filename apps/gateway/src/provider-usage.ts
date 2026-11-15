import type { Delivery } from "./outbox.js";
export function usdToNanos(value: number): string {
  if (!Number.isFinite(value) || value < 0)
    throw new Error("INVALID_PROVIDER_COST");
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value))!;
  const digits = BigInt(match[1]! + (match[2] ?? ""));
  const shift = 9 + Number(match[3] ?? 0) - (match[2]?.length ?? 0);
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  const nanos =
    shift >= 0
      ? digits * 10n ** BigInt(shift)
      : (digits + divisor - 1n) / divisor;
  if (nanos > 9223372036854775807n) throw new Error("INVALID_PROVIDER_COST");
  return nanos.toString();
}
export function providerUsage(
  provider: string,
  raw: Record<string, unknown>,
): NonNullable<Delivery["usage"]> {
  const count = (value: unknown) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new Error("INVALID_PROVIDER_USAGE");
    return BigInt(value);
  };
  const meters: Record<string, string> = {};
  if (provider === "google") {
    const cached = count(raw.cachedContentTokenCount ?? 0);
    meters.input_tokens = (count(raw.promptTokenCount) - cached).toString();
    meters.output_tokens = (
      count(raw.candidatesTokenCount ?? 0) + count(raw.thoughtsTokenCount ?? 0)
    ).toString();
    if (cached) meters.cached_input_tokens = cached.toString();
  } else if (provider === "anthropic") {
    meters.input_tokens = count(raw.input_tokens).toString();
    meters.output_tokens = count(raw.output_tokens).toString();
    if (raw.cache_read_input_tokens)
      meters.cached_input_tokens = count(
        raw.cache_read_input_tokens,
      ).toString();
    if (raw.cache_creation_input_tokens)
      meters.cache_write_tokens = count(
        raw.cache_creation_input_tokens,
      ).toString();
  } else {
    const details = (raw.prompt_tokens_details ?? raw.input_tokens_details) as
      { cached_tokens?: number } | undefined;
    const cached = count(details?.cached_tokens ?? 0);
    meters.input_tokens = (
      count(raw.prompt_tokens ?? raw.input_tokens) - cached
    ).toString();
    meters.output_tokens = count(
      raw.completion_tokens ?? raw.output_tokens,
    ).toString();
    if (cached) meters.cached_input_tokens = cached.toString();
  }
  if (Object.values(meters).some((v) => BigInt(v) < 0n))
    throw new Error("INVALID_PROVIDER_USAGE");
  const usage: NonNullable<Delivery["usage"]> = { meters, rawUsage: raw };
  if (provider === "openrouter") {
    const cost = raw.cost;
    if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0)
      throw new Error("MISSING_PROVIDER_COST");
    usage.providerCostNanos = usdToNanos(cost);
  }
  return usage;
}
