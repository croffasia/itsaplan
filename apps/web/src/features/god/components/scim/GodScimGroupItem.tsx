'use client';

import { UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceScimGroup } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';

export default function GodScimGroupItem({
  group,
  onEdit,
}: {
  group: InstanceScimGroup;
  onEdit: () => void;
}) {
  const t = useTranslations('god.scim');

  const grants = group.mappings
    .map((m) => `${m.projectKey} (${t(m.role === 'owner' ? 'roleOwner' : 'roleMember')})`)
    .join(', ');

  return (
    <Item
      size="sm"
      className="rounded-none border-0 border-b border-border px-1 last:border-b-0 hover:bg-accent/50"
    >
      <ItemMedia>
        <UsersRound className="size-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{group.displayName}</ItemTitle>
        <ItemDescription>
          {t('memberCount', { count: group.memberCount })} · {grants || t('grantsNothing')}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t('editMappings')}
        </Button>
      </ItemActions>
    </Item>
  );
}
