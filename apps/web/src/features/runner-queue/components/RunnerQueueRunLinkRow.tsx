import {
  ArrowUpRight,
  CircleDot,
  FileText,
  FolderKanban,
  LayoutList,
  Link2,
  StickyNote,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { useLinkPreviewQuery } from '@/components/common/editor/useLinkPreviewQuery';
import { Skeleton } from '@/components/ui/skeleton';

const ICONS = {
  project: FolderKanban,
  issue: CircleDot,
  document: FileText,
  notes: StickyNote,
  view: LayoutList,
};

// A page of the workspace the answer links to, named by its title.
export default function RunnerQueueRunLinkRow({ url }: { url: string }) {
  const t = useTranslations('common.editor');
  const relativeTime = useRelativeTime();
  const { data, isPending } = useLinkPreviewQuery(url);
  const Icon = data?.kind ? ICONS[data.kind] : Link2;
  const meta = [
    data?.siteName,
    data?.updatedAt && t('previewUpdated', { date: relativeTime(data.updatedAt) }),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg bg-muted px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <span className="row-span-2 flex size-9 items-center justify-center rounded-lg bg-background">
        <Icon aria-hidden className="size-4" />
      </span>
      {isPending ? (
        <Skeleton className="h-4 w-3/5" />
      ) : (
        <span className="truncate text-sm font-semibold" dir="auto">
          {data?.title || url}
        </span>
      )}
      <ArrowUpRight aria-hidden className="row-span-2 size-4 text-muted-foreground" />
      <span className="truncate text-xs text-muted-foreground" dir="auto">
        {meta || url}
      </span>
    </a>
  );
}
