// Money is stored and computed in integer minor units (cents) everywhere.
// Only presentation converts to a major-unit string.

export function formatMoney(cents: number, currency = "EUR", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// Parse a major-unit string ("12.50", "€12.50", "1,234.56") to integer cents.
// Throws on anything that isn't a parseable amount — callers surface the error.
export function parseAmountToCents(input: string): number {
  const normalized = input.replace(/[^0-9.-]/g, "");
  if (normalized === "" || normalized === "-" || !/^-?\d*(\.\d+)?$/.test(normalized)) {
    throw new RangeError(`Not a valid money amount: ${input}`);
  }
  return Math.round(Number(normalized) * 100);
}
