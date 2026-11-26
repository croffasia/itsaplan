import { type ReactNode } from 'react';
import { CirclePlus } from 'lucide-react';
import type { IssueLinkInputKind } from '@/lib/api/endpoints/issues';
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
import { CREATE_LINK_RELATIONS, LINK_RELATIONS, LINK_RELATION_ICONS } from '@/utils/issueLinks';
import { useLinkRelationLabel } from '@/hooks/useLinkRelationLabel';
import { useTranslations } from 'next-intl';

// The relations themselves link an issue found through the search dialog; the
// submenu below them names the relation for an issue created on the spot. The Links
// heading and the issue's add bar open it from their own triggers.
export default function IssueLinksAddMenu({
  trigger,
  align = 'end',
  canCreate,
  onLinkExisting,
  onCreateNew,
}: {
  trigger: ReactNode;
  align?: 'start' | 'end';
  canCreate: boolean;
  onLinkExisting: (relation: IssueLinkInputKind) => void;
  onCreateNew: (relation: IssueLinkInputKind) => void;
}) {
  const t = useTranslations('issue.links');
  const relationLabel = useLinkRelationLabel();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        {LINK_RELATIONS.map((relation) => {
          const Icon = LINK_RELATION_ICONS[relation];
          return (
            <DropdownMenuItem key={relation} onSelect={() => onLinkExisting(relation)}>
              <Icon />
              {relationLabel(relation)}
            </DropdownMenuItem>
          );
        })}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CirclePlus />
                {t('newIssue')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {CREATE_LINK_RELATIONS.map((relation) => {
                  const Icon = LINK_RELATION_ICONS[relation];
                  return (
                    <DropdownMenuItem key={relation} onSelect={() => onCreateNew(relation)}>
                      <Icon />
                      {relationLabel(relation)}
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
