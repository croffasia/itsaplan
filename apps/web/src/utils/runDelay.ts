// The delay the server stores for a triggered agent run: delegation, a field trigger,
// a status schedule. A blank or unparseable input means no delay; the value is clamped
// to the server's 0..24h range.
export function delaySecFromMinutes(minutes: string): number {
  const n = Math.round(Number(minutes.trim()));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 1440) * 60;
}
