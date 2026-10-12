import { formatShortDate, formatTime } from '@/utils/dates';

// 1200 reads as "1.2K", 1_400_000 as "1.4M": short enough to sit beside a cost on one
// line of a panel.
export function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

// A price per million tokens, as the price list reads it: cents, and the fractions of a
// cent a cheap model is priced in.
export function formatRate(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

// An amount in USD. A run of a small model costs fractions of a cent, so an amount under
// a cent keeps enough digits to be read rather than rounding to $0.00. Null is what the
// API sends for a model the price table does not name.
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

// How far a figure moved from the same span before it. Null when a previous period of
// zero leaves nothing to compare against.
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

// The x-axis label of a chart point. A window of a day is bucketed by the hour, so its
// points are told apart by the time rather than the date. A day bucket starts at the
// database's midnight, so it is labelled by its date and not moved into the viewer's
// zone, where it would read as the day before west of it.
export function bucketLabel(window: { from: string; to: string }, value: string): string {
  const hourly = new Date(window.to).getTime() - new Date(window.from).getTime() <= 25 * 3_600_000;
  return hourly ? formatTime(value) : formatShortDate(value.slice(0, 10));
}
