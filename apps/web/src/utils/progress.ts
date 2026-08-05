// How much of a set of issues is done, as a percentage. Canceled issues leave the
// denominator so the number reflects deliverable work.
export function progressPercent(progress: {
  completed: number;
  canceled: number;
  total: number;
}): number {
  const denom = progress.total - progress.canceled;
  return denom > 0 ? Math.round((progress.completed / denom) * 100) : 0;
}
