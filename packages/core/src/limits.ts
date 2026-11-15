export interface LimitRule {
  scope: "account" | "actor";
  window: "minute" | "hour" | "day" | "month";
  meter: "credits" | "requests" | "cost_nanos";
  max: string;
  feature?: string;
}

export function resolveLimits(
  sources: readonly LimitRule[][],
  overrides: readonly LimitRule[],
) {
  const result = new Map<string, LimitRule>();
  const key = (rule: LimitRule) =>
    JSON.stringify([rule.scope, rule.window, rule.meter, rule.feature ?? null]);
  for (const rules of sources)
    for (const rule of rules) {
      const previous = result.get(key(rule));
      if (!previous || BigInt(rule.max) > BigInt(previous.max))
        result.set(key(rule), rule);
    }
  for (const rule of overrides) result.set(key(rule), rule);
  return [...result.values()];
}

/** Fixed calendar windows in UTC; month length follows the calendar. */
export function limitWindow(window: LimitRule["window"], now: Date) {
  const start = new Date(now);
  start.setUTCSeconds(0, 0);
  if (window !== "minute") start.setUTCMinutes(0);
  if (window === "day" || window === "month") start.setUTCHours(0);
  if (window === "month") start.setUTCDate(1);
  const end = new Date(start);
  if (window === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  else
    end.setTime(
      end.getTime() + { minute: 60000, hour: 3600000, day: 86400000 }[window],
    );
  return { start, end };
}
