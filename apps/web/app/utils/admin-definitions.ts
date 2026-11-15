export const adminActionDefinitions: Record<string, string[]> = {
  route: ["provider", "model", "variant", "kind"],
  productRoute: ["productId", "routeId"],
  markup: ["productId", "version", "tiers", "minChargeMilli", "effectiveFrom"],
  limitPolicy: ["productId", "window", "meter", "max"],
  endVersion: ["id", "effectiveTo"],
  publish: ["target", "id", "effectiveFrom"],
  revokeVersion: ["id"],
  routePrice: ["routeId", "version", "effectiveFrom", "items"],
  price: ["featureId", "version", "creditsMilli", "unit", "per"],
  product: ["code", "name"],
  feature: ["productId", "key", "pricing"],
  rate: ["productId", "version", "creditValueMicros"],
  plan: ["code", "name", "productScope", "kind"],
  version: [
    "planId",
    "version",
    "creditGrants",
    "limits",
    "entitlements",
    "creditGrantInterval",
    "creditGrantIntervalCount",
  ],
  key: ["productId", "name", "scopes"],
  revokeKey: ["id"],
  credits: ["productId", "accountId", "amountMilli", "creditRateVersionId"],
};

export const adminSectionColumns: Record<string, string[]> = {
  tasks: ["id", "kind", "accountId", "status", "details"],
  routes: ["id", "provider", "model", "variant", "kind"],
  markups: [
    "id",
    "productId",
    "version",
    "tiers",
    "minChargeMilli",
    "effectiveFrom",
    "publishedAt",
  ],
  productRoutes: ["productId", "routeId", "isActive"],
  margin: [
    "productId",
    "routeId",
    "provider",
    "model",
    "creditsChargedMilli",
    "costNanos",
    "valueNanos",
    "marginNanos",
    "requests",
  ],
  routePrices: [
    "id",
    "routeId",
    "version",
    "effectiveFrom",
    "items",
    "publishedAt",
  ],
  products: ["id", "code", "name", "status"],
  features: ["id", "productId", "key", "pricing", "status"],
  prices: ["id", "featureId", "version", "creditsMilli", "unit", "per"],
  rates: [
    "id",
    "productId",
    "version",
    "creditValueMicros",
    "publishedAt",
    "effectiveFrom",
  ],
  plans: ["id", "code", "name", "kind", "productScope"],
  versions: [
    "id",
    "planId",
    "version",
    "creditGrants",
    "entitlements",
    "limits",
    "publishedAt",
    "effectiveFrom",
    "effectiveTo",
    "revokedAt",
  ],
  keys: ["id", "productId", "name", "prefix", "scopes", "status"],
};

export function formatAdminCell(row: unknown, field: string): string {
  if (!row || typeof row !== "object") return "";
  const value = (row as Record<string, unknown>)[field];
  return typeof value === "object"
    ? JSON.stringify(value)
    : String(value ?? "");
}
