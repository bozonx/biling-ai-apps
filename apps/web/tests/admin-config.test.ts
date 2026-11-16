import { describe, expect, test } from "vitest";
import {
  getFieldConfig,
  ADMIN_ENUM_OPTIONS,
  JSON_TEMPLATES,
} from "../app/utils/admin-field-config";

describe("admin field config", () => {
  test("identifies JSON fields and assigns default templates", () => {
    const fields = ["tiers", "items", "creditGrants", "limits", "entitlements"];
    for (const field of fields) {
      const config = getFieldConfig("anyAction", field);
      expect(config.control).toBe("json");
      expect(config.template).toEqual(JSON_TEMPLATES[field]);
    }
  });

  test("identifies datetime fields", () => {
    expect(getFieldConfig("markup", "effectiveFrom").control).toBe("datetime");
    expect(getFieldConfig("endVersion", "effectiveTo").control).toBe(
      "datetime",
    );
  });

  test("identifies numeric fields and sets bounds", () => {
    const versionConfig = getFieldConfig("rate", "version");
    expect(versionConfig.control).toBe("number");
    expect(versionConfig.min).toBe(1);

    const minChargeConfig = getFieldConfig("markup", "minChargeMilli");
    expect(minChargeConfig.control).toBe("number");
    expect(minChargeConfig.min).toBe(0);

    const intervalCountConfig = getFieldConfig(
      "version",
      "creditGrantIntervalCount",
    );
    expect(intervalCountConfig.control).toBe("number");
    expect(intervalCountConfig.min).toBe(1);
    expect(intervalCountConfig.max).toBe(120);
  });

  test("identifies select enum controls", () => {
    const routeKind = getFieldConfig("route", "kind");
    expect(routeKind.control).toBe("select");
    expect(routeKind.options).toEqual(ADMIN_ENUM_OPTIONS.routeKind);

    const pricing = getFieldConfig("feature", "pricing");
    expect(pricing.control).toBe("select");
    expect(pricing.options).toEqual(ADMIN_ENUM_OPTIONS.featurePricing);

    const planKind = getFieldConfig("plan", "kind");
    expect(planKind.control).toBe("select");
    expect(planKind.options).toEqual(ADMIN_ENUM_OPTIONS.planKind);
  });

  test("identifies multiselect controls for scopes and productScope", () => {
    const scopes = getFieldConfig("key", "scopes");
    expect(scopes.control).toBe("multiselect");
    expect(scopes.options).toEqual(ADMIN_ENUM_OPTIONS.keyScopes);

    const productScope = getFieldConfig("plan", "productScope");
    expect(productScope.control).toBe("multiselect");
    expect(typeof productScope.getCatalogOptions).toBe("function");
  });

  test("maps catalog entity selections", () => {
    const productConfig = getFieldConfig("feature", "productId");
    expect(productConfig.control).toBe("select");
    expect(productConfig.catalogKey).toBe("products");

    const sampleCatalog = {
      products: [{ id: "prod-1", name: "Text AI", code: "text-ai" }],
    };
    const options = productConfig.getCatalogOptions?.(sampleCatalog);
    expect(options).toEqual([{ label: "Text AI (text-ai)", value: "prod-1" }]);
  });

  test("identifies status and boolean controls", () => {
    const statusConfig = getFieldConfig("product", "status");
    expect(statusConfig.control).toBe("select");
    expect(statusConfig.options).toEqual(["active", "disabled"]);

    const activeConfig = getFieldConfig("productRoute", "isActive");
    expect(activeConfig.control).toBe("select");
    expect(activeConfig.options).toEqual(["true", "false"]);
  });
});
