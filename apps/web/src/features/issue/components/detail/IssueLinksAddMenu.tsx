import { CirclePlus, Plus } from 'lucide-react';
import { type IssueLinkInputKind } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CREATE_LINK_RELATIONS,
  LINK_RELATIONS,
  LINK_RELATION_ICONS,
  LINK_RELATION_LABELS,
} from '@/utils/issueLinks';

// The relations themselves link an issue found through the search dialog; the
// submenu below them names the relation for an issue created on the spot.
export default function IssueLinksAddMenu({
  canCreate,
  onLinkExisting,
  onCreateNew,
}: {
  canCreate: boolean;
  onLinkExisting: (relation: IssueLinkInputKind) => void;
  onCreateNew: (relation: IssueLinkInputKind) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5">
          <Plus className="size-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LINK_RELATIONS.map((relation) => {
          const Icon = LINK_RELATION_ICONS[relation];
          return (
            <DropdownMenuItem key={relation} onSelect={() => onLinkExisting(relation)}>
              <Icon />
              {LINK_RELATION_LABELS[relation]}
            </DropdownMenuItem>
          );
        })}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CirclePlus />
                New issue
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {CREATE_LINK_RELATIONS.map((relation) => {
                  const Icon = LINK_RELATION_ICONS[relation];
                  return (
                    <DropdownMenuItem key={relation} onSelect={() => onCreateNew(relation)}>
                      <Icon />
                      {LINK_RELATION_LABELS[relation]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
