import { describe, expect, test } from "vitest";
import {
  parseRoutePriceItems,
  getRoutePriceSummary,
  buildRoutePriceItems,
  getAssignedProductsForRoute,
} from "../app/utils/route-helpers";

describe("route helpers and cost calculations", () => {
  test("builds RoutePriceItems from human-readable USD costs", () => {
    const items = buildRoutePriceItems({
      inputUsdPer1M: 1.5,
      outputUsdPer1M: 6.0,
      audioUsdPerMin: 0.006,
    });

    expect(items).toHaveLength(3);

    const inputItem = items.find((i) => i.meter === "input_tokens");
    expect(inputItem).toBeDefined();
    expect(inputItem?.per).toBe("1000000");
    expect(inputItem?.unitNanos).toBe("1500000000"); // 1.5 * 1e9

    const outputItem = items.find((i) => i.meter === "output_tokens");
    expect(outputItem).toBeDefined();
    expect(outputItem?.per).toBe("1000000");
    expect(outputItem?.unitNanos).toBe("6000000000"); // 6.0 * 1e9

    const audioItem = items.find((i) => i.meter === "audio_seconds");
    expect(audioItem).toBeDefined();
    expect(audioItem?.per).toBe("1");
    // 0.006 / 60 * 1e9 = 100000
    expect(audioItem?.unitNanos).toBe("100000");
  });

  test("parses RoutePriceItems into USD rates", () => {
    const items = [
      {
        meter: "input_tokens",
        unitNanos: "1500000000",
        per: "1000000",
      },
      {
        meter: "output_tokens",
        unitNanos: "6000000000",
        per: "1000000",
      },
    ];

    const result = parseRoutePriceItems(items);
    expect(result.inputPer1M).toBe(1.5);
    expect(result.outputPer1M).toBe(6.0);
    expect(result.details).toHaveLength(2);
    expect(result.details[0]?.formatted).toBe("$1.50 / 1M tok");
    expect(result.details[1]?.formatted).toBe("$6.00 / 1M tok");
  });

  test("resolves route price summary for active published version", () => {
    const routePrices = [
      {
        id: "rp-1",
        routeId: "route-1",
        version: 1,
        effectiveFrom: "2026-01-01T00:00:00Z",
        publishedAt: "2026-01-01T00:00:00Z",
        items: [
          {
            meter: "input_tokens",
            unitNanos: "2000000000",
            per: "1000000",
          },
          {
            meter: "output_tokens",
            unitNanos: "8000000000",
            per: "1000000",
          },
        ],
      },
      {
        id: "rp-2",
        routeId: "route-1",
        version: 2,
        effectiveFrom: "2026-02-01T00:00:00Z",
        publishedAt: null, // Draft
        items: [],
      },
    ];

    const summary = getRoutePriceSummary("route-1", routePrices);
    expect(summary.version).toBe(1);
    expect(summary.isPublished).toBe(true);
    expect(summary.formattedSummary).toBe("$2.00 / $8.00 (1M)");
  });

  test("handles empty or unconfigured route prices gracefully", () => {
    const summary = getRoutePriceSummary("non-existent-route", []);
    expect(summary.version).toBe(0);
    expect(summary.isPublished).toBe(false);
    expect(summary.formattedSummary).toBe("—");
  });

  test("maps assigned products for route", () => {
    const products = [
      { id: "p-1", name: "TyCo", code: "tyco" },
      { id: "p-2", name: "FastCat", code: "fastcat" },
    ];
    const productRoutes = [
      { productId: "p-1", routeId: "route-1", isActive: true },
      { productId: "p-2", routeId: "route-2", isActive: false },
    ];

    const assigned = getAssignedProductsForRoute(
      "route-1",
      productRoutes,
      products,
    );
    expect(assigned).toHaveLength(1);
    expect(assigned[0]?.name).toBe("TyCo");
    expect(assigned[0]?.code).toBe("tyco");
    expect(assigned[0]?.isActive).toBe(true);
  });
});
