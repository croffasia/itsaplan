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
