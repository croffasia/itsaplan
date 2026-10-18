import { useTranslations } from 'next-intl';
import type { BoardDraft } from '@/lib/api/endpoints/ai-assist';
import { Badge } from '@/components/ui/badge';

export default function AiAssistBoardPreview({ draft }: { draft: BoardDraft }) {
  const t = useTranslations('aiAssist.board');

  return (
    <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border p-3 text-sm">
      <div className="space-y-1.5">
        <p className="font-medium">{t('columns')}</p>
        <div className="flex flex-wrap gap-1.5">
          {draft.columns.map((column) => (
            <Badge key={column.name} variant="secondary" dir="auto">
              {column.name}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="font-medium">{t('issues')}</p>
        <ul className="space-y-1">
          {draft.issues.map((issue, index) => (
            <li key={index} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate" dir="auto">
                {issue.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {issue.column}
                {issue.dueDate && ` · ${t('due', { date: issue.dueDate })}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
