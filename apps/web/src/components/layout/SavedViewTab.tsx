import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, Globe, MoreHorizontal, Pencil, Star, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { enableViewShare, disableViewShare } from '@/lib/api/endpoints/share';
import { qk } from '@/services/queryKeys';
import { usePublishView, useSetViewFavorite } from '@/services/views.service';
import { cn } from '@/lib/utils';
import { shareViewCalendarPath, shareViewPath } from '@/utils/paths';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ViewTabChrome from '@/components/layout/ViewTabChrome';
import ViewTabLabel from '@/components/layout/ViewTabLabel';
import ShareDialog from '@/components/common/share/ShareDialog';

// A saved view tab. Sortable (drag to reorder); when active it shows a "…" menu
// with Favorite / Duplicate / Share / Add to the project / Edit / Delete.
export default function SavedViewTab({
  view,
  projectKey,
  active,
  canEdit,
  canDelete,
  canReorder,
  canPublish,
  canDuplicate,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  view: View;
  projectKey: string;
  active: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReorder: boolean;
  canPublish: boolean;
  canDuplicate: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const t = useTranslations('views');
  const tCommon = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const qc = useQueryClient();
  const setFavorite = useSetViewFavorite(projectKey);
  const publish = usePublishView(projectKey);

  // Enabling/revoking the public link refetches the views so the tab's shareToken
  // and shareExtended (which the dialog reads) stay in sync. The same call creates
  // the link and flips how much a live one exposes.
  async function share(extended: boolean) {
    const { token } = await enableViewShare(view.id, extended);
    await qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    return token;
  }
  async function disableShare() {
    await disableViewShare(view.id);
    await qc.invalidateQueries({ queryKey: qk.views(projectKey) });
  }
  // Reordering the project's views is a views edit; one's own private views need none.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: view.id,
    disabled: !canReorder,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <ViewTabChrome
      active={active}
      own={view.isPrivate}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(canReorder ? 'cursor-grab' : 'cursor-default', isDragging && 'opacity-40')}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-1.5 py-1 pr-1 pl-2">
        <ViewTabLabel view={view} />
      </button>
      {/* Favoriting is personal and needs no permission, so an active tab always has a menu. */}
      {active ? (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={t('options')}
              className="mr-1.5 rounded p-0.5 hover:bg-accent-foreground/10"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setFavorite.mutate({ id: view.id, favorite: !view.favorite });
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
            >
              <Star
                className={cn('size-3.5 shrink-0', view.favorite && 'fill-current text-amber-500')}
              />
              {view.favorite ? t('unfavorite') : t('favorite')}
            </button>
            {canDuplicate && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-start text-sm hover:bg-accent"
              >
                <Copy className="size-3.5 shrink-0" /> {t('duplicate')}
              </button>
            )}
            {/* Only a project's view has a public link. */}
            {canEdit && !view.isPrivate && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSharing(true);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
              >
                <Globe className="size-3.5 shrink-0" /> {view.shareToken ? t('shared') : t('share')}
              </button>
            )}
            {canPublish && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  publish.mutate(view.id);
                }}
                className="flex w-full items-start gap-2 rounded px-2 py-1 text-start text-sm hover:bg-accent"
              >
                <Users className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {t('publish')}
                  <span className="block text-xs text-muted-foreground">{t('publishHint')}</span>
                </span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
              >
                <Pencil className="size-3.5 shrink-0" /> {tCommon('edit')}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5 shrink-0" /> {tCommon('delete')}
              </button>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="w-1.5" />
      )}
      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        title={t('shareBoard')}
        token={view.shareToken}
        extended={view.shareExtended}
        enable={share}
        disable={disableShare}
        pathForToken={shareViewPath}
        calendarPathForToken={shareViewCalendarPath}
      />
    </ViewTabChrome>
  );
}
