// The issue counts a progress bar reads, as CycleProgress and InitiativeProgress
// both carry them.
type Progress = { completed: number; canceled: number; total: number };

// How much of a set of issues is done, as a percentage. Canceled issues leave the
// denominator so the number reflects deliverable work.
export function progressPercent(progress: Progress): number {
  const denom = progress.total - progress.canceled;
  return denom > 0 ? Math.round((progress.completed / denom) * 100) : 0;
}

// The issues that are neither completed nor canceled — the ones a cycle transfer
// moves and a cycle finish leaves behind.
export function unfinishedCount(progress: Progress): number {
  return progress.total - progress.completed - progress.canceled;
}
