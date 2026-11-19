// Compact form for the directory's counts, so a five-digit number does not widen a
// column: anything under 1000 stays as it is, larger values are scaled to K/M/B with
// up to two decimals and no trailing zeros ("1K", "1.12K", "12.48K", "3.4M").
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function compactCount(value: number): string {
  return compact.format(value);
}

// A typed value that is a whole number from min to max. An empty field fails: Number('')
// is 0, which would save a limit nobody typed.
export function wholeNumberIn(value: string, min: number, max: number): boolean {
  const number = Number(value);
  return /^\d+$/.test(value.trim()) && number >= min && number <= max;
}
