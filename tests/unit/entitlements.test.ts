import {
  resolveEntitlements,
  satisfiesEntitlements,
  type EntitlementDefinition,
} from "../../packages/core/src/index.js";
const definitions: EntitlementDefinition[] = [
  {
    key: "enabled",
    type: "bool",
    merge: "or",
    enumValues: [],
    keepOnReadOnly: false,
  },
  {
    key: "tier",
    type: "enum",
    merge: "max",
    enumValues: ["basic", "pro", "top"],
    keepOnReadOnly: true,
  },
  {
    key: "count",
    type: "int",
    merge: "max",
    enumValues: [],
    keepOnReadOnly: false,
  },
];
test("merges base sources by max and or and applies overrides last", () => {
  const values = resolveEntitlements(
    definitions,
    [
      { values: { enabled: false, tier: "pro", count: 10 } },
      { values: { enabled: true, tier: "basic", count: 5 } },
    ],
    [{ key: "enabled", value: false }],
  );
  expect(values).toEqual({ enabled: false, tier: "pro", count: 10 });
  expect(
    satisfiesEntitlements(definitions, values, { tier: "basic", count: 10 }),
  ).toBe(true);
  expect(satisfiesEntitlements(definitions, values, { enabled: true })).toBe(
    false,
  );
  expect(satisfiesEntitlements(definitions, values, { tier: "top" })).toBe(
    false,
  );
  expect(satisfiesEntitlements(definitions, values, { unknown: true })).toBe(
    false,
  );
});
test("read-only sources retain only declared keys and malformed configurations fail closed", () => {
  expect(
    resolveEntitlements(
      definitions,
      [{ values: { enabled: true, tier: "pro", count: 10 }, readOnly: true }],
      [],
    ),
  ).toEqual({ tier: "pro" });
  expect(() =>
    resolveEntitlements(definitions, [{ values: { tier: "invalid" } }], []),
  ).toThrow();
  expect(satisfiesEntitlements(definitions, {}, { enabled: false })).toBe(
    false,
  );
});
