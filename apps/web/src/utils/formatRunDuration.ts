// An agent run or one of its steps takes a fraction of a second to hours: "0.4s", "48s",
// "1m 07s", "2h 05m".
export function formatRunDuration(ms: number): string {
  if (ms < 9_950) return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
