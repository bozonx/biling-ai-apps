export function accrualBoundary(
  anchor: Date,
  interval: string,
  count: number,
  index: number,
) {
  const result = new Date(anchor);
  const step = count * index;
  if (interval === "day" || interval === "week") {
    result.setUTCDate(
      anchor.getUTCDate() + step * (interval === "week" ? 7 : 1),
    );
  } else {
    result.setUTCDate(1);
    result.setUTCMonth(
      anchor.getUTCMonth() + step * (interval === "year" ? 12 : 1),
    );
    const last = new Date(result);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    result.setUTCDate(Math.min(anchor.getUTCDate(), last.getUTCDate()));
  }
  return result;
}
