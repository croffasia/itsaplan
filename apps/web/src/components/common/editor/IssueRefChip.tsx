import { useRef } from 'react';
import { issuePath } from '@/utils/paths';
import type { ResolvedLinkPreview } from './resolveLinkPreview';
import { useLinkPreviewQuery } from './useLinkPreviewQuery';

// The link an issue identifier is drawn as in read-only text: the state colour, the
// identifier and the title, read through the same query as the hover card.
export default function IssueRefChip({
  projectKey,
  sequence,
}: {
  projectKey: string;
  sequence: number;
}) {
  const path = issuePath(projectKey, sequence);
  const { data, isError } = useLinkPreviewQuery(new URL(path, window.location.origin).href);
  // The query hides an internal preview while it revalidates, which the hover card
  // starts on every open. The chip keeps what it showed until the answer is a failure.
  const shown = useRef<ResolvedLinkPreview | undefined>(undefined);
  if (data) shown.current = data;
  if (isError) shown.current = undefined;
  const preview = shown.current;
  return (
    <a href={path} className="issue-ref">
      {preview?.status && (
        <span className="issue-ref-dot" style={{ backgroundColor: preview.status.color }} />
      )}
      <span className="issue-ref-id">{`${projectKey}-${sequence}`}</span>
      {preview?.issueTitle && <span className="issue-ref-title">{preview.issueTitle}</span>}
    </a>
  );
}
