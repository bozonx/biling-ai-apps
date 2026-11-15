export interface EntitlementDefinition {
  key: string;
  type: "bool" | "int" | "enum";
  merge: "max" | "or";
  enumValues: string[];
  keepOnReadOnly: boolean;
}
export type EntitlementValue = boolean | number | string;
function valid(
  definition: EntitlementDefinition,
  value: unknown,
): value is EntitlementValue {
  if (definition.type === "bool")
    return typeof value === "boolean" && definition.merge === "or";
  if (definition.merge !== "max") return false;
  if (definition.type === "int")
    return (
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    );
  return typeof value === "string" && definition.enumValues.includes(value);
}
export function resolveEntitlements(
  definitions: readonly EntitlementDefinition[],
  sources: readonly { values: Record<string, unknown>; readOnly?: boolean }[],
  overrides: readonly { key: string; value: unknown }[],
): Record<string, EntitlementValue> {
  const result: Record<string, EntitlementValue> = Object.create(null);
  for (const definition of definitions) {
    for (const source of sources) {
      if (source.readOnly && !definition.keepOnReadOnly) continue;
      const value = source.values[definition.key];
      if (value === undefined) continue;
      if (!valid(definition, value))
        throw new RangeError("Invalid entitlement configuration");
      const previous = result[definition.key];
      if (previous === undefined) result[definition.key] = value;
      else if (definition.type === "bool")
        result[definition.key] = previous === true || value === true;
      else if (definition.type === "int")
        result[definition.key] = Math.max(previous as number, value as number);
      else if (
        definition.enumValues.indexOf(value as string) >
        definition.enumValues.indexOf(previous as string)
      )
        result[definition.key] = value;
    }
    for (const override of overrides.filter(
      (item) => item.key === definition.key,
    )) {
      if (!valid(definition, override.value))
        throw new RangeError("Invalid entitlement override");
      result[definition.key] = override.value;
    }
  }
  return result;
}
export function satisfiesEntitlements(
  definitions: readonly EntitlementDefinition[],
  values: Record<string, EntitlementValue>,
  requirements: Record<string, unknown>,
): boolean {
  return Object.entries(requirements).every(([key, required]) => {
    const definition = definitions.find((item) => item.key === key);
    if (!definition || !valid(definition, required)) return false;
    const actual = values[key];
    if (actual === undefined) return false;
    if (definition.type === "bool") return actual === required;
    if (definition.type === "int")
      return (actual as number) >= (required as number);
    return (
      definition.enumValues.indexOf(actual as string) >=
      definition.enumValues.indexOf(required as string)
    );
  });
}
