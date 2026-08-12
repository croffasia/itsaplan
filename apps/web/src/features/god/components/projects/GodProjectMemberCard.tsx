'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceProjectMember, PermissionCatalog } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import GodAccessCard from '../GodAccessCard';

// One member of the project, as a row in the project panel.
export default function GodProjectMemberCard({
  member,
  catalog,
}: {
  member: InstanceProjectMember;
  catalog: PermissionCatalog | undefined;
}) {
  const t = useTranslations('god.access');
  const tCommon = useTranslations('common');
  const tUsers = useTranslations('god.users');
  const isOwner = member.role === 'owner';

  return (
    <GodAccessCard
      isOwner={isOwner}
      roleName={member.roleName}
      permissions={member.permissions}
      catalog={catalog}
      header={
        <>
          <Avatar
            name={member.name || member.email}
            image={member.image}
            className="size-6 shrink-0 text-[10px]"
          />
          <span className="min-w-0 flex-1 truncate text-sm">{member.name || member.email}</span>
          {member.isAgent && (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-medium">
              <Bot className="size-3" />
              {tUsers('agent')}
            </Badge>
          )}
          <Badge
            variant={isOwner ? 'default' : 'secondary'}
            className="px-1.5 py-0 text-[10px] font-medium"
          >
            {isOwner ? tCommon('owner') : (member.roleName ?? tCommon('member'))}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('joined', { date: formatShortDate(member.joinedAt) })}
          </span>
        </>
      }
    />
  );
}
