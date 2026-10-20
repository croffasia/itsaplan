import { useIssueQuery } from '@/services/issues.service';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// The tab title of an open issue, `MKT-42 Fix the login`. A failed read keeps the
// last data, so it gives no title then, as while the issue loads.
export function useIssueTitle(issueId: number | null, layer: 'page' | 'panel') {
  const query = useIssueQuery(issueId);
  const issue = query.isError ? undefined : query.data;
  useDocumentTitle(issue ? `${issue.identifier} ${issue.title}` : null, layer);
}
