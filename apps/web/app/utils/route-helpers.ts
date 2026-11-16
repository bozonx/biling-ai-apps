export interface RoutePriceItem {
  meter: string;
  unitNanos: string | number | bigint;
  per: string | number | bigint;
  tier?: Record<string, unknown> | null;
  minBillableUnits?: string | number | bigint | null;
}

export interface RoutePriceSummary {
  version: number;
  isPublished: boolean;
  effectiveFrom: string;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  audioCostPerMinuteUsd?: number;
  formattedSummary: string;
}

export interface AssignedProduct {
  productId: string;
  name: string;
  code: string;
  isActive: boolean;
  requires?: Record<string, unknown>;
}

/**
 * Calculates human-readable USD costs from RoutePriceItem array
 */
export function parseRoutePriceItems(items: RoutePriceItem[]): {
  inputPer1M?: number;
  outputPer1M?: number;
  audioPerMin?: number;
  details: Array<{ meter: string; formatted: string }>;
} {
  let inputPer1M: number | undefined;
  let outputPer1M: number | undefined;
  let audioPerMin: number | undefined;
  const details: Array<{ meter: string; formatted: string }> = [];

  for (const item of items) {
    const nanos = Number(item.unitNanos);
    const per = Number(item.per) || 1;
    if (Number.isNaN(nanos) || nanos <= 0) continue;

    // Rate in USD per 1 basic unit:
    const usdPerUnit = nanos / 1e9 / per;

    if (item.meter === "input_tokens") {
      inputPer1M = +(usdPerUnit * 1_000_000).toFixed(4);
      details.push({
        meter: "input_tokens",
        formatted: `$${inputPer1M.toFixed(inputPer1M >= 1 ? 2 : 4)} / 1M tok`,
      });
    } else if (item.meter === "output_tokens") {
      outputPer1M = +(usdPerUnit * 1_000_000).toFixed(4);
      details.push({
        meter: "output_tokens",
        formatted: `$${outputPer1M.toFixed(outputPer1M >= 1 ? 2 : 4)} / 1M tok`,
      });
    } else if (item.meter === "audio_seconds") {
      audioPerMin = +(usdPerUnit * 60).toFixed(4);
      details.push({
        meter: "audio_seconds",
        formatted: `$${audioPerMin.toFixed(audioPerMin >= 1 ? 2 : 4)} / min`,
      });
    } else {
      const perLabel =
        per >= 1_000_000 ? `${per / 1_000_000}M` : per > 1 ? `${per}` : "";
      const priceUsd = nanos / 1e9;
      details.push({
        meter: item.meter,
        formatted: `$${priceUsd.toFixed(4)}${perLabel ? ` / ${perLabel}` : ""}`,
      });
    }
  }

  return { inputPer1M, outputPer1M, audioPerMin, details };
}

export interface RawRoutePriceVersion {
  id?: string;
  routeId?: string;
  version?: number | string;
  effectiveFrom?: string | Date;
  publishedAt?: string | Date | null;
  items?: RoutePriceItem[];
}

/**
 * Finds and formats active or latest price version for a given route
 */
export function getRoutePriceSummary(
  routeId: string,
  routePrices?: Array<Record<string, unknown>>,
): RoutePriceSummary {
  if (!routePrices || !routePrices.length) {
    return {
      version: 0,
      isPublished: false,
      effectiveFrom: "",
      formattedSummary: "—",
    };
  }

  const matching = (routePrices as unknown as RawRoutePriceVersion[]).filter(
    (rp) => rp.routeId === routeId,
  );
  if (!matching.length) {
    return {
      version: 0,
      isPublished: false,
      effectiveFrom: "",
      formattedSummary: "—",
    };
  }

  // Published first, sorted by effectiveFrom descending
  const published = matching
    .filter((rp) => Boolean(rp.publishedAt))
    .sort((a, b) => {
      const timeB = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
      const timeA = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
      return timeB - timeA;
    });

  const sortedByVersion = [...matching].sort(
    (a, b) => Number(b.version || 0) - Number(a.version || 0),
  );

  const targetVersion = published[0] ?? sortedByVersion[0];
  if (!targetVersion) {
    return {
      version: 0,
      isPublished: false,
      effectiveFrom: "",
      formattedSummary: "—",
    };
  }

  const items = targetVersion.items || [];
  const { inputPer1M, outputPer1M, audioPerMin, details } =
    parseRoutePriceItems(items);

  let formattedSummary = "";
  if (inputPer1M !== undefined && outputPer1M !== undefined) {
    formattedSummary = `$${inputPer1M.toFixed(inputPer1M >= 1 ? 2 : 3)} / $${outputPer1M.toFixed(outputPer1M >= 1 ? 2 : 3)} (1M)`;
  } else if (audioPerMin !== undefined) {
    formattedSummary = `$${audioPerMin.toFixed(audioPerMin >= 1 ? 2 : 3)} / min`;
  } else if (details.length > 0) {
    formattedSummary = details.map((d) => d.formatted).join(", ");
  } else {
    formattedSummary = targetVersion.publishedAt ? "Free / Custom" : "Draft";
  }

  return {
    version: Number(targetVersion.version) || 1,
    isPublished: Boolean(targetVersion.publishedAt),
    effectiveFrom: targetVersion.effectiveFrom
      ? String(targetVersion.effectiveFrom)
      : "",
    inputCostPerMillionUsd: inputPer1M,
    outputCostPerMillionUsd: outputPer1M,
    audioCostPerMinuteUsd: audioPerMin,
    formattedSummary,
  };
}

/**
 * Converts user-friendly USD inputs to RoutePriceItem[] for the backend
 */
export function buildRoutePriceItems(input: {
  inputUsdPer1M?: number;
  outputUsdPer1M?: number;
  audioUsdPerMin?: number;
  customMeter?: string;
  customUsdPerUnit?: number;
}): RoutePriceItem[] {
  const items: RoutePriceItem[] = [];

  if (input.inputUsdPer1M && input.inputUsdPer1M > 0) {
    // 1M tokens cost inputUsdPer1M.
    // unitNanos for 1_000_000 tokens:
    const nanos = Math.round(input.inputUsdPer1M * 1e9);
    items.push({
      meter: "input_tokens",
      unitNanos: String(nanos),
      per: "1000000",
    });
  }

  if (input.outputUsdPer1M && input.outputUsdPer1M > 0) {
    const nanos = Math.round(input.outputUsdPer1M * 1e9);
    items.push({
      meter: "output_tokens",
      unitNanos: String(nanos),
      per: "1000000",
    });
  }

  if (input.audioUsdPerMin && input.audioUsdPerMin > 0) {
    // 60 seconds cost audioUsdPerMin.
    // 1 second costs audioUsdPerMin / 60
    const nanosPerSec = Math.round((input.audioUsdPerMin / 60) * 1e9);
    items.push({
      meter: "audio_seconds",
      unitNanos: String(nanosPerSec),
      per: "1",
    });
  }

  if (
    input.customMeter &&
    input.customUsdPerUnit &&
    input.customUsdPerUnit > 0
  ) {
    const nanos = Math.round(input.customUsdPerUnit * 1e9);
    items.push({
      meter: input.customMeter,
      unitNanos: String(nanos),
      per: "1",
    });
  }

  return items;
}

/**
 * Resolves assigned products for a route
 */
export function getAssignedProductsForRoute(
  routeId: string,
  productRoutes?: Array<Record<string, unknown>>,
  products?: Array<Record<string, unknown>>,
): AssignedProduct[] {
  if (!productRoutes || !productRoutes.length) return [];
  const assigned = productRoutes.filter((pr) => pr.routeId === routeId);

  return assigned.map((pr) => {
    const prod = products?.find((p) => p.id === pr.productId);
    return {
      productId: String(pr.productId),
      name: (prod?.name as string | undefined) || String(pr.productId),
      code: (prod?.code as string | undefined) || "",
      isActive: Boolean(pr.isActive),
      requires: pr.requires as Record<string, unknown> | undefined,
    };
  });
}
