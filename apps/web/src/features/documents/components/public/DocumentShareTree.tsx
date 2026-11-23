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
      className="w-66 shrink-0 overflow-y-auto bg-rail px-2 py-3 max-[860px]:max-h-40 max-[860px]:w-auto"
    >
      <ul className="flex flex-col">
        {treeRows(pages).map(({ page, depth }) => (
          <li key={page.id}>
            <button
              type="button"
              aria-current={page.id === currentId ? 'page' : undefined}
              onClick={() => onOpen(page.id)}
              style={{ paddingInlineStart: `calc(0.5rem + ${depth} * 0.875rem)` }}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md pe-1 text-start text-sm transition-colors hover:bg-accent',
                page.id === currentId && 'bg-accent font-medium',
              )}
            >
              <span className="grid size-5 shrink-0 place-items-center text-[15px] leading-none text-muted-foreground">
                {page.icon ?? <FileText className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {page.title || t('untitled')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
