import { describe, expect, test } from "vitest";
import { availableMilli, formatCredits } from "../app/utils/credits";
import { ApiError, errorMessageKey, toApiError } from "../app/utils/api-error";
import { isNavActive } from "../app/utils/navigation";
import {
  ADMIN_NAVIGATION,
  findAdminNavItem,
  isAdminNavActive,
} from "../app/utils/admin-navigation";

describe("credits", () => {
  test("formats milli-credits without float loss", () => {
    expect(formatCredits("1234500", "en-US")).toBe("1,234.5");
    expect(formatCredits("0", "en-US")).toBe("0");
    expect(formatCredits("9223372036854775807", "en-US")).toBe(
      "9,223,372,036,854,775.807",
    );
  });
  test("available never goes below zero", () => {
    expect(availableMilli("1000", "300")).toBe("700");
    expect(availableMilli("100", "300")).toBe("0");
  });
});

describe("api errors", () => {
  test("keeps backend code and maps it to a known key", () => {
    const error = toApiError({
      response: { status: 400 },
      data: { code: "INVALID_REQUEST" },
    });
    expect(error.code).toBe("INVALID_REQUEST");
    expect(errorMessageKey(error)).toBe("errors.INVALID_REQUEST");
  });
  test("maps status and unknown codes", () => {
    expect(toApiError({ response: { status: 503 } }).code).toBe("SERVER_ERROR");
    expect(toApiError(new TypeError("fetch failed")).code).toBe(
      "NETWORK_ERROR",
    );
    expect(errorMessageKey(new ApiError("SOMETHING_NEW"))).toBe(
      "errors.UNKNOWN",
    );
  });
});

test("navigation matches nested routes but not the root prefix", () => {
  expect(isNavActive("/settings/account", "/settings")).toBe(true);
  expect(isNavActive("/operations", "/")).toBe(false);
});

describe("admin navigation", () => {
  test("excludes settings from sidebar navigation", () => {
    const allPaths = ADMIN_NAVIGATION.flatMap((group) =>
      group.items.map((item) => item.to),
    );
    expect(allPaths).not.toContain("/admin/settings");
  });

  test("resolves admin nav items including settings", () => {
    expect(findAdminNavItem("/admin")?.item.labelKey).toBe(
      "admin.nav.overview",
    );
    expect(findAdminNavItem("/admin/products")?.item.labelKey).toBe(
      "admin.nav.products",
    );
    expect(findAdminNavItem("/admin/settings")?.item.labelKey).toBe(
      "admin.nav.settings",
    );
  });

  test("evaluates active state correctly", () => {
    expect(isAdminNavActive("/admin", "/admin")).toBe(true);
    expect(isAdminNavActive("/admin/products", "/admin")).toBe(false);
    expect(isAdminNavActive("/admin/products/item-1", "/admin/products")).toBe(
      true,
    );
  });
});
