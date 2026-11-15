const KNOWN_KINDS = new Set([
  "accrual",
  "purchase",
  "grant",
  "commit",
  "expiry",
  "refund",
  "revoke",
  "adjustment",
]);

/** Localized label for an operation kind; unknown kinds fall back to the raw code. */
export function operationKindLabel(kind: string): string {
  const { $i18n } = useNuxtApp();
  return KNOWN_KINDS.has(kind) ? $i18n.t(`operations.kinds.${kind}`) : kind;
}
