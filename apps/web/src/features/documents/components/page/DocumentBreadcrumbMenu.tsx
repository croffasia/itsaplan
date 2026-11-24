'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, ChevronDown, FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { documentPath } from '@/utils/paths';

// One breadcrumb: a link to the page and a menu of the pages under it.
export default function DocumentBreadcrumbMenu({
  projectKey,
  label,
  href,
  pages,
  activeIds,
  createLabel,
  onCreate,
}: {
  projectKey: string;
  label: string;
  href: string;
  pages: ProjectDocumentSummary[];
  // The open page and its ancestors: the menu marks the one on the current path.
  activeIds: Set<number>;
  createLabel: string;
  onCreate?: () => void;
}) {
  const t = useTranslations('documents');

  return (
    <span className="flex min-w-0 items-center">
      <Link
        href={href}
        className="max-w-56 truncate rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        dir="auto"
      >
        {label}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="grid h-[22px] w-[18px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          aria-label={t('pagesIn', { title: label })}
        >
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={href}>
              <ArrowUpRight />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {t('openPage', { title: label })}
              </span>
            </Link>
          </DropdownMenuItem>
          {pages.length > 0 && <DropdownMenuSeparator />}
          {pages.map((page) => (
            <DropdownMenuItem key={page.id} asChild>
              <Link href={documentPath(projectKey, page.id)}>
                <span
                  className="grid size-5 shrink-0 place-items-center text-[15px] leading-none text-muted-foreground"
                  aria-hidden
                >
                  {page.icon || <FileText className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {page.title.trim() || t('untitled')}
                </span>
                {activeIds.has(page.id) && <Check />}
              </Link>
            </DropdownMenuItem>
          ))}
          {onCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCreate}>
                <Plus />
                {createLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
