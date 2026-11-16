import { describe, expect, test } from "vitest";
import {
  findAdminNavItem,
  isAdminNavActive,
} from "../app/utils/admin-navigation";
import ruLocale from "../i18n/locales/ru.json";
import enLocale from "../i18n/locales/en-US.json";

describe("admin hierarchy navigation", () => {
  test("resolves parent items for nested detail routes", () => {
    expect(findAdminNavItem("/admin/products/prod-123")?.item.labelKey).toBe(
      "admin.nav.products",
    );
    expect(findAdminNavItem("/admin/plans/plan-456")?.item.labelKey).toBe(
      "admin.nav.plans",
    );
    expect(findAdminNavItem("/admin/routes/route-789")?.item.labelKey).toBe(
      "admin.nav.routes",
    );
  });

  test("marks parent sidebar link as active for detail subpaths", () => {
    expect(
      isAdminNavActive("/admin/products/01931a2b", "/admin/products"),
    ).toBe(true);
    expect(isAdminNavActive("/admin/plans/01931a2c", "/admin/plans")).toBe(
      true,
    );
    expect(isAdminNavActive("/admin/routes/01931a2d", "/admin/routes")).toBe(
      true,
    );
    expect(isAdminNavActive("/admin/products/01931a2b", "/admin/pricing")).toBe(
      false,
    );
  });

  test("has matching i18n keys for product, plan, and route hierarchy", () => {
    const checkKeys = [
      "filterByProduct",
      "allProducts",
      "productDetail.backToProducts",
      "productDetail.switchProduct",
      "productDetail.settings",
      "productDetail.lateCommitWindow",
      "productDetail.customSettings",
      "productDetail.tabs.overview",
      "productDetail.tabs.features",
      "productDetail.tabs.plans",
      "productDetail.tabs.ai",
      "productDetail.tabs.keys",
      "productDetail.notFound",
      "planDetail.backToPlans",
      "planDetail.versions",
      "planDetail.productScope",
      "planDetail.notFound",
      "routeDetail.backToRoutes",
      "routeDetail.prices",
      "routeDetail.products",
      "routeDetail.notFound",
    ];

    function getNestedValue(
      obj: Record<string, unknown>,
      path: string,
    ): unknown {
      return path
        .split(".")
        .reduce(
          (acc, part) => (acc as Record<string, unknown> | undefined)?.[part],
          obj as unknown,
        );
    }

    for (const key of checkKeys) {
      const ruVal = getNestedValue(ruLocale.admin, key);
      const enVal = getNestedValue(enLocale.admin, key);
      expect(ruVal, `Missing ru translation for admin.${key}`).toBeDefined();
      expect(enVal, `Missing en-US translation for admin.${key}`).toBeDefined();
    }
  });
});
