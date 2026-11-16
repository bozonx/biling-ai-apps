import { describe, expect, test } from "vitest";
import {
  sectionToActionMap,
  adminEditFieldDefinitions,
  adminActionDefinitions,
} from "../app/utils/admin-definitions";

describe("admin modals and entity mappings", () => {
  test("maps catalog sections to create actions", () => {
    expect(sectionToActionMap.products).toBe("product");
    expect(sectionToActionMap.plans).toBe("plan");
    expect(sectionToActionMap.versions).toBe("version");
    expect(sectionToActionMap.features).toBe("feature");
    expect(sectionToActionMap.prices).toBe("price");
    expect(sectionToActionMap.rates).toBe("rate");
    expect(sectionToActionMap.routes).toBe("route");
    expect(sectionToActionMap.routePrices).toBe("routePrice");
    expect(sectionToActionMap.productRoutes).toBe("productRoute");
    expect(sectionToActionMap.markups).toBe("markup");
    expect(sectionToActionMap.keys).toBe("key");
    expect(sectionToActionMap.tasks).toBeUndefined();
    expect(sectionToActionMap.margin).toBeUndefined();
  });

  test("defines editable fields for catalog entities", () => {
    expect(adminEditFieldDefinitions.product).toEqual(["name", "status"]);
    expect(adminEditFieldDefinitions.plan).toEqual([
      "name",
      "kind",
      "productScope",
    ]);
    expect(adminEditFieldDefinitions.feature).toEqual(["pricing", "status"]);
    expect(adminEditFieldDefinitions.route).toEqual([
      "kind",
      "provider",
      "model",
      "variant",
    ]);
    expect(adminEditFieldDefinitions.productRoute).toEqual(["isActive"]);
    expect(adminEditFieldDefinitions.key).toEqual(["name", "scopes"]);
  });

  test("action definitions include all required fields for creation", () => {
    expect(adminActionDefinitions.product).toEqual(["code", "name"]);
    expect(adminActionDefinitions.plan).toEqual([
      "code",
      "name",
      "productScope",
      "kind",
    ]);
    expect(adminActionDefinitions.route).toEqual([
      "kind",
      "provider",
      "model",
      "variant",
    ]);
    expect(adminActionDefinitions.key).toEqual(["productId", "name", "scopes"]);
  });
});
