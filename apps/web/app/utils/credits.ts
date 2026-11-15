const MILLI = 1000n;

/** Formats a milli-credit decimal string without losing precision. */
export function formatCredits(milli: string, locale: string): string {
  const value = BigInt(milli);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = new Intl.NumberFormat(locale).format(abs / MILLI);
  const fraction = (abs % MILLI).toString().padStart(3, "0").replace(/0+$/, "");
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  return `${negative ? "-" : ""}${whole}${fraction ? separator + fraction : ""}`;
}

/** Available = balance - held, floored at zero. */
export function availableMilli(balance: string, held: string): string {
  const value = BigInt(balance) - BigInt(held);
  return (value > 0n ? value : 0n).toString();
}
