import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Globe, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api, type View } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { useSetViewFavorite } from '@/services/views.service';
import { cn } from '@/lib/utils';
import { shareViewPath } from '@/utils/paths';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ViewTabChrome from '@/components/layout/ViewTabChrome';
import ViewTabLabel from '@/components/layout/ViewTabLabel';
import ShareDialog from '@/components/common/share/ShareDialog';

// A saved view tab. Sortable (drag to reorder); when active it shows a "…" menu
// with Favorite / Share / Edit / Delete.
export default function SavedViewTab({
  view,
  projectKey,
  active,
  canEdit,
  canDelete,
  onSelect,
  onEdit,
  onDelete,
}: {
  view: View;
  projectKey: string;
  active: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('views');
  const tCommon = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const qc = useQueryClient();
  const setFavorite = useSetViewFavorite(projectKey);

  // Enabling/revoking the public link refetches the views so the tab's shareToken
  // and shareExtended (which the dialog reads) stay in sync. The same call creates
  // the link and flips how much a live one exposes.
  async function share(extended: boolean) {
    const { token } = await api.enableViewShare(view.id, extended);
    await qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    return token;
  }
  async function disableShare() {
    await api.disableViewShare(view.id);
    await qc.invalidateQueries({ queryKey: qk.views(projectKey) });
  }
  // Reordering views is a views edit; disable dragging without it.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: view.id,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <ViewTabChrome
      active={active}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(canEdit ? 'cursor-grab' : 'cursor-default', isDragging && 'opacity-40')}
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
            {canEdit && (
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
      />
    </ViewTabChrome>
  );
}
