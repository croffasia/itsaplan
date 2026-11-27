import type { IssuePropertyRowSpec } from '../hooks/useIssuePropertyRows';

// What folded Properties keep in view, in this order.
const SUMMARY_KEYS = ['state', 'priority', 'assignee', 'delegate', 'dueDate'];

export function summaryRows(rows: IssuePropertyRowSpec[]): IssuePropertyRowSpec[] {
  return SUMMARY_KEYS.flatMap((key) => rows.filter((row) => row.key === key));
}
