import { useRef } from 'react';
import { useIssueRefs } from '@/context/issueRefs';
import { issuePath, splitProjectRef } from '@/utils/paths';
import type { ResolvedLinkPreview } from './resolveLinkPreview';
import { useLinkPreviewQuery } from './useLinkPreviewQuery';

// The link an issue identifier is drawn as in read-only text: the state colour, the
// identifier and the title, read through the same query as the hover card. On a public share page they come
// from the share, and the chip opens the issue under it.
export default function IssueRefChip({
  projectRef,
  sequence,
}: {
  projectRef: string;
  sequence: number;
}) {
  const { shared } = useIssueRefs();
  const path = issuePath(projectRef, sequence);
  const { data, isError } = useLinkPreviewQuery(
    shared ? undefined : new URL(path, window.location.origin).href,
  );
  // The query hides an internal preview while it revalidates, which the hover card
  // starts on every open. The chip keeps what it showed until the answer is a failure.
  const shown = useRef<ResolvedLinkPreview | undefined>(undefined);
  if (data) shown.current = data;
  if (isError) shown.current = undefined;
  const preview = shown.current;
  const id = `${splitProjectRef(projectRef).key}-${sequence}`;

  if (shared) {
    const issue = shared.issues.get(sequence);
    const content = (
      <>
        {issue && <span className="issue-ref-dot" style={{ backgroundColor: issue.state.color }} />}
        <span className="issue-ref-id">{id}</span>
        {issue && <span className="issue-ref-title">{issue.title}</span>}
      </>
    );
    return issue ? (
      <a href={shared.href(issue.id)} className="issue-ref" title={issue.state.name}>
        {content}
      </a>
    ) : (
      <span className="issue-ref">{content}</span>
    );
  }

  return (
    <a href={path} className="issue-ref">
      {preview?.status && (
        <span className="issue-ref-dot" style={{ backgroundColor: preview.status.color }} />
      )}
      <span className="issue-ref-id">{id}</span>
      {preview?.issueTitle && <span className="issue-ref-title">{preview.issueTitle}</span>}
    </a>
  );
}
