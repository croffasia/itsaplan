import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SharedDocumentPage } from '@/lib/api/endpoints/share';
import { cn } from '@/lib/utils';

// The pages a shared link opens, nested under the shared page, in tree order.
function treeRows(pages: SharedDocumentPage[]): { page: SharedDocumentPage; depth: number }[] {
  const rows: { page: SharedDocumentPage; depth: number }[] = [];
  const visit = (page: SharedDocumentPage, depth: number) => {
    rows.push({ page, depth });
    for (const child of pages) if (child.parentId === page.id) visit(child, depth + 1);
  };
  visit(pages[0], 0);
  return rows;
}

export default function DocumentShareTree({
  pages,
  currentId,
  onOpen,
}: {
  pages: SharedDocumentPage[];
  currentId: number;
  onOpen: (id: number) => void;
}) {
  const t = useTranslations('documents');

  return (
    <nav
      aria-label={t('sharedPages')}
      className="max-h-48 shrink-0 overflow-y-auto border-b px-3 py-3 md:sticky md:top-0 md:max-h-screen md:w-64 md:border-e md:border-b-0"
    >
      <ul className="flex flex-col gap-0.5">
        {treeRows(pages).map(({ page, depth }) => (
          <li key={page.id}>
            <button
              type="button"
              aria-current={page.id === currentId ? 'page' : undefined}
              onClick={() => onOpen(page.id)}
              style={{ paddingInlineStart: `${0.5 + depth}rem` }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md py-1.5 pe-2 text-start text-sm hover:bg-accent',
                page.id === currentId && 'bg-accent font-medium',
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                {page.icon ?? <FileText className="size-3.5" />}
              </span>
              <span className="min-w-0 truncate" dir="auto">
                {page.title || t('untitled')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
