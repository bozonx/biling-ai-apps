import {
  resolveLimits,
  limitWindow,
  type LimitRule,
} from "../../packages/core/src/index.js";

const rule: LimitRule = {
  scope: "account",
  meter: "requests",
  window: "day",
  max: "10",
};
test("limits choose the most generous base and then the override", () => {
  expect(resolveLimits([[rule], [{ ...rule, max: "20" }]], [])).toEqual([
    { ...rule, max: "20" },
  ]);
  expect(
    resolveLimits([[rule], [{ ...rule, max: "20" }]], [{ ...rule, max: "0" }]),
  ).toEqual([{ ...rule, max: "0" }]);
});
test("feature and actor limits retain independent counters", () => {
  expect(
    resolveLimits(
      [[rule, { ...rule, scope: "actor" }, { ...rule, feature: "generate" }]],
      [],
    ),
  ).toHaveLength(3);
});

test("UTC month windows cross years and respect leap days", () => {
  expect(limitWindow("month", new Date("2024-02-29T23:59:59Z"))).toEqual({
    start: new Date("2024-02-01T00:00:00Z"),
    end: new Date("2024-03-01T00:00:00Z"),
  });
  expect(limitWindow("month", new Date("2024-12-31T23:59:59Z")).end).toEqual(
    new Date("2025-01-01T00:00:00Z"),
  );
});
