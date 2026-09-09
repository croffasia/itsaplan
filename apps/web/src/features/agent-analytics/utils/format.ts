import { formatShortDate, formatTime } from '@/utils/dates';

// Number formatting for the agent dashboard. A panel shows a token count next to a
// bar and a cost next to it, so both are short enough to sit on one line.

// Token counts and call counts, shortened: 1200 reads as "1.2K", 1_400_000 as "1.4M".
export function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

// An amount in USD. A run of a small model costs fractions of a cent, so an amount
// under a cent keeps enough digits to be read rather than rounding to $0.00. Null is
// what the API sends for a model the price table does not name.
export function formatCost(value: number | null): string {
  if (value == null) return '—';
  const digits = value !== 0 && value < 0.01 ? 4 : 2;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

// How far the figure moved from the same span before it, as a percentage. Null when
// there is nothing to compare against: a previous period of zero has no ratio.
export function changeRatio(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(ratio);
}

// A latency in milliseconds, as the panels label it: "820ms", "5.6s", "2m 5s".
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// The x-axis label of a chart point. A window of a day is bucketed by the hour, so its
// points are told apart by the time rather than the date.
export function bucketLabel(window: { from: string; to: string }, value: string): string {
  const hourly = new Date(window.to).getTime() - new Date(window.from).getTime() <= 25 * 3_600_000;
  return hourly ? formatTime(value) : formatShortDate(value);
}
