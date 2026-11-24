import { History, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The actions on one agent in its row's last cell. The caller passes only the handlers
// the viewer may use; the menu is not drawn when there are none.
export function TeamAiAgentMenu({
  onEdit,
  onRuns,
  onChat,
  onDelete,
}: {
  onEdit?: () => void;
  onRuns?: () => void;
  onChat?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations('teams.agents');
  const tCommon = useTranslations('common');
  if (!onEdit && !onRuns && !onChat && !onDelete) return null;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('moreActions')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onEdit}>
              <Pencil />
              {tCommon('edit')}
            </DropdownMenuItem>
          )}
          {onRuns && (
            <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onRuns}>
              <History />
              {t('runHistory')}
            </DropdownMenuItem>
          )}
          {onChat && (
            <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onChat}>
              <MessageSquare />
              {t('testChat')}
            </DropdownMenuItem>
          )}
          {onDelete && (onEdit || onRuns || onChat) && <DropdownMenuSeparator />}
          {onDelete && (
            <DropdownMenuItem
              className="min-h-11 sm:min-h-8"
              variant="destructive"
              onSelect={onDelete}
            >
              <Trash2 />
              {tCommon('delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
