export type AdminFieldControl =
  "text" | "number" | "select" | "multiselect" | "datetime" | "json";

export interface SelectOption {
  label: string;
  value: string;
}

export interface AdminFieldConfig {
  control: AdminFieldControl;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  enumKey?: string;
  options?: string[];
  catalogKey?: string;
  getCatalogOptions?: (
    catalog: Record<string, unknown[]>,
    actionValues?: Record<string, unknown>,
  ) => SelectOption[];
  template?: object | string;
}

export const ADMIN_ENUM_OPTIONS: Record<string, string[]> = {
  routeKind: ["llm", "stt", "tts", "image", "video", "mt", "embed"],
  featurePricing: ["fixed", "metered"],
  planKind: ["base", "addon"],
  limitWindow: ["minute", "hour", "day", "month"],
  limitMeter: ["requests", "credits", "cost_nanos"],
  grantInterval: ["day", "week", "month", "year"],
  publishTarget: ["version", "rate", "routePrice", "markup"],
  keyScopes: [
    "wallets:read",
    "entitlements:read",
    "usage:read",
    "holds:write",
    "credits:grant",
  ],
};

export const JSON_TEMPLATES: Record<string, object> = {
  tiers: [
    {
      upToCostNanoUsd: "1000000000",
      percent: 20,
    },
  ],
  items: [
    {
      meter: "input_tokens",
      unitNanos: "1000",
      per: "1000",
    },
  ],
  creditGrants: {
    "product-code": "10000",
  },
  limits: {
    "product-code": [
      {
        scope: "account",
        window: "day",
        meter: "requests",
        max: "1000",
      },
    ],
  },
  entitlements: {
    "product-code": {
      standard_access: true,
      max_parallel_requests: 5,
    },
  },
};

export function getFieldConfig(
  action: string,
  field: string,
): AdminFieldConfig {
  // 1. JSON fields
  if (
    ["creditGrants", "entitlements", "items", "limits", "tiers"].includes(field)
  ) {
    return {
      control: "json",
      template: JSON_TEMPLATES[field],
    };
  }

  // 2. Datetime fields
  if (["effectiveFrom", "effectiveTo"].includes(field)) {
    return {
      control: "datetime",
    };
  }

  // 3. Number fields
  if (field === "version") {
    return { control: "number", min: 1, step: 1 };
  }
  if (field === "creditGrantIntervalCount") {
    return { control: "number", min: 1, max: 120, step: 1 };
  }
  if (["creditsMilli", "amountMilli"].includes(field)) {
    return { control: "number", min: 1, step: 1000 };
  }
  if (["minChargeMilli", "max"].includes(field)) {
    return { control: "number", min: 0, step: 1 };
  }
  if (field === "creditValueMicros") {
    return { control: "number", min: 1, step: 1000 };
  }
  if (field === "per") {
    return { control: "number", min: 1, step: 1 };
  }

  // 4. Catalog selections by ID
  if (field === "productId") {
    return {
      control: "select",
      catalogKey: "products",
      getCatalogOptions: (catalog) => {
        const products = (catalog.products ?? []) as Array<{
          id: string;
          name: string;
          code: string;
        }>;
        return products.map((p) => ({
          label: `${p.name} (${p.code})`,
          value: p.id,
        }));
      },
    };
  }

  if (field === "routeId") {
    return {
      control: "select",
      catalogKey: "routes",
      getCatalogOptions: (catalog) => {
        const routes = (catalog.routes ?? []) as Array<{
          id: string;
          provider: string;
          model: string;
          variant: string;
          kind: string;
        }>;
        return routes.map((r) => ({
          label: `${r.provider} / ${r.model} [${r.variant}] (${r.kind})`,
          value: r.id,
        }));
      },
    };
  }

  if (field === "planId") {
    return {
      control: "select",
      catalogKey: "plans",
      getCatalogOptions: (catalog) => {
        const plans = (catalog.plans ?? []) as Array<{
          id: string;
          name: string;
          code: string;
        }>;
        return plans.map((p) => ({
          label: `${p.name} (${p.code})`,
          value: p.id,
        }));
      },
    };
  }

  if (field === "featureId") {
    return {
      control: "select",
      catalogKey: "features",
      getCatalogOptions: (catalog) => {
        const features = (catalog.features ?? []) as Array<{
          id: string;
          key: string;
          productId: string;
        }>;
        return features.map((f) => ({
          label: `${f.key} (${f.productId})`,
          value: f.id,
        }));
      },
    };
  }

  if (field === "creditRateVersionId") {
    return {
      control: "select",
      catalogKey: "rates",
      getCatalogOptions: (catalog) => {
        const rates = (catalog.rates ?? []) as Array<{
          id: string;
          version: number;
          creditValueMicros: string | number;
        }>;
        return rates.map((r) => ({
          label: `v${r.version} — ${r.creditValueMicros} µUSD`,
          value: r.id,
        }));
      },
    };
  }

  // Action-specific IDs (revokeKey, revokeVersion, endVersion, publish)
  if (action === "revokeKey" && field === "id") {
    return {
      control: "select",
      catalogKey: "keys",
      getCatalogOptions: (catalog) => {
        const keys = (catalog.keys ?? []) as Array<{
          id: string;
          name: string;
          prefix: string;
          status: string;
        }>;
        return keys
          .filter((k) => k.status !== "revoked")
          .map((k) => ({
            label: `${k.name} (${k.prefix}...)`,
            value: k.id,
          }));
      },
    };
  }

  if (
    (action === "revokeVersion" || action === "endVersion") &&
    field === "id"
  ) {
    return {
      control: "select",
      catalogKey: "versions",
      getCatalogOptions: (catalog) => {
        const versions = (catalog.versions ?? []) as Array<{
          id: string;
          version: number;
          planId: string;
          revokedAt: string | null;
        }>;
        return versions
          .filter((v) => action === "endVersion" || !v.revokedAt)
          .map((v) => ({
            label: `v${v.version} (Plan ID: ${v.planId})`,
            value: v.id,
          }));
      },
    };
  }

  if (action === "publish" && field === "id") {
    return {
      control: "select",
      getCatalogOptions: (catalog, values) => {
        const target = values?.target as string | undefined;
        if (target === "rate") {
          const rates = (catalog.rates ?? []) as Array<{
            id: string;
            version: number;
            publishedAt: string | null;
          }>;
          return rates
            .filter((r) => !r.publishedAt)
            .map((r) => ({ label: `Rate v${r.version}`, value: r.id }));
        }
        if (target === "routePrice") {
          const rps = (catalog.routePrices ?? []) as Array<{
            id: string;
            version: number;
            publishedAt: string | null;
          }>;
          return rps
            .filter((r) => !r.publishedAt)
            .map((r) => ({ label: `RoutePrice v${r.version}`, value: r.id }));
        }
        if (target === "markup") {
          const markups = (catalog.markups ?? []) as Array<{
            id: string;
            version: number;
            publishedAt: string | null;
          }>;
          return markups
            .filter((m) => !m.publishedAt)
            .map((m) => ({ label: `Markup v${m.version}`, value: m.id }));
        }
        const versions = (catalog.versions ?? []) as Array<{
          id: string;
          version: number;
          publishedAt: string | null;
        }>;
        return versions
          .filter((v) => !v.publishedAt)
          .map((v) => ({ label: `Plan Version v${v.version}`, value: v.id }));
      },
    };
  }

  // 5. Enums
  if (action === "route" && field === "kind") {
    return {
      control: "select",
      enumKey: "routeKind",
      options: ADMIN_ENUM_OPTIONS.routeKind,
    };
  }

  if (action === "feature" && field === "pricing") {
    return {
      control: "select",
      enumKey: "featurePricing",
      options: ADMIN_ENUM_OPTIONS.featurePricing,
    };
  }

  if (action === "plan" && field === "kind") {
    return {
      control: "select",
      enumKey: "planKind",
      options: ADMIN_ENUM_OPTIONS.planKind,
    };
  }

  if (action === "limitPolicy" && field === "window") {
    return {
      control: "select",
      enumKey: "limitWindow",
      options: ADMIN_ENUM_OPTIONS.limitWindow,
    };
  }

  if (action === "limitPolicy" && field === "meter") {
    return {
      control: "select",
      enumKey: "limitMeter",
      options: ADMIN_ENUM_OPTIONS.limitMeter,
    };
  }

  if (action === "version" && field === "creditGrantInterval") {
    return {
      control: "select",
      enumKey: "grantInterval",
      options: ADMIN_ENUM_OPTIONS.grantInterval,
    };
  }

  if (action === "publish" && field === "target") {
    return {
      control: "select",
      enumKey: "publishTarget",
      options: ADMIN_ENUM_OPTIONS.publishTarget,
    };
  }

  // 6. Multiselect / Checkboxes
  if (action === "key" && field === "scopes") {
    return {
      control: "multiselect",
      enumKey: "keyScopes",
      options: ADMIN_ENUM_OPTIONS.keyScopes,
    };
  }

  if (action === "plan" && field === "productScope") {
    return {
      control: "multiselect",
      catalogKey: "products",
      getCatalogOptions: (catalog) => {
        const products = (catalog.products ?? []) as Array<{
          id: string;
          name: string;
          code: string;
        }>;
        return products.map((p) => ({
          label: `${p.name} (${p.code})`,
          value: p.code,
        }));
      },
    };
  }

  // 7. Text fields by default
  return { control: "text" };
}
