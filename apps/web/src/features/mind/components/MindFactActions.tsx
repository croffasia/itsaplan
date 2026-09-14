import { Archive, BadgeCheck, Flag, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MindCategory, MindFact, MindStatus } from '@/lib/api';
import { CATEGORY_META, CATEGORY_ORDER } from '../utils/mind';

export default function MindFactActions({
  fact,
  canEdit,
  canDelete,
  onStatus,
  onCategory,
  onForget,
}: {
  fact: MindFact;
  canEdit: boolean;
  canDelete: boolean;
  onStatus: (status: MindStatus) => void;
  onCategory: (category: MindCategory) => void;
  onForget: () => void;
}) {
  if (!canEdit && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Fact actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <>
            <DropdownMenuItem
              disabled={fact.status === 'verified'}
              onSelect={() => onStatus('verified')}
            >
              <BadgeCheck className="size-4" />
              Mark verified
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={fact.status === 'conflicted'}
              onSelect={() => onStatus('conflicted')}
            >
              <Flag className="size-4" />
              Flag a conflict
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Archive className="size-4" />
                File under
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Category
                </DropdownMenuLabel>
                {CATEGORY_ORDER.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    disabled={category === fact.category}
                    onSelect={() => onCategory(category)}
                  >
                    {CATEGORY_META[category].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        {canEdit && canDelete && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onSelect={onForget}>
            <Trash2 className="size-4" />
            Forget
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
