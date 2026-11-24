import { useTranslations } from 'next-intl';
import type { SharedDocumentIssue } from '@/lib/api/endpoints/share';

// The work items a shared page names, when its link shows them. Each opens read-only
// under the same link.
export default function DocumentShareIssues({
  projectKey,
  issues,
  onOpen,
}: {
  projectKey: string;
  issues: SharedDocumentIssue[];
  onOpen: (issueId: number) => void;
}) {
  const t = useTranslations('documents');
  if (issues.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="shared-issues">
      <h2 id="shared-issues" className="mb-3 text-[13px] font-medium text-muted-foreground">
        {t('sharedIssues')}
      </h2>
      <ul className="flex flex-col">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button
              type="button"
              onClick={() => onOpen(issue.id)}
              className="-mx-2 flex min-h-9 w-[calc(100%+1rem)] items-center gap-2.5 rounded-md ps-2 pe-1 text-start text-[13px] transition-colors hover:bg-accent"
            >
              <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">
                {projectKey}-{issue.sequence}
              </span>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {issue.title}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-px text-xs text-muted-foreground">
                {issue.state.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
