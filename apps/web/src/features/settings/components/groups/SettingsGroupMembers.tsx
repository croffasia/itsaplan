import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectGroup } from '@/lib/api/endpoints/groups';
import type { Assignee } from '@/lib/api/endpoints/projects';
import Avatar from '@/components/common/Avatar';
import PopoverPick from '@/components/common/fields/PopoverPick';
import { useSettingsCan } from '../../context/settingsPermission';

const SHOWN = 5;

// The people in a group: an avatar stack with the count. Someone who may edit the
// group opens a picker over the project's members from it; a reader sees the stack
// alone.
export default function SettingsGroupMembers({
  group,
  members,
  onChange,
}: {
  group: ProjectGroup;
  members: Assignee[];
  onChange: (userIds: string[]) => void;
}) {
  const t = useTranslations('settings.groups');
  const canEdit = useSettingsCan()('edit');
  const inGroup = members.filter((m) => group.memberIds.includes(m.userId));

  const summary = (
    <span className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground">
      {inGroup.length > 0 ? (
        <span className="flex items-center -space-x-1.5">
          {inGroup.slice(0, SHOWN).map((m) => (
            <Avatar
              key={m.userId}
              name={m.name}
              image={m.image}
              className="size-5 ring-2 ring-background"
            />
          ))}
        </span>
      ) : (
        <Users className="size-3.5" />
      )}
      <span className="tabular-nums">{t('memberCount', { count: inGroup.length })}</span>
    </span>
  );

  if (!canEdit) return summary;

  return (
    <PopoverPick
      trigger={
        <button type="button" className="rounded-md hover:bg-accent">
          {summary}
        </button>
      }
      inputPlaceholder={t('searchMembers')}
      emptyText={t('noMembers')}
      closeOnSelect={false}
      items={members.map((m) => {
        const selected = group.memberIds.includes(m.userId);
        return {
          key: m.userId,
          search: m.name,
          icon: <Avatar name={m.name} image={m.image} className="size-4 text-[8px]" />,
          label: m.name,
          selected,
          onSelect: () =>
            onChange(
              selected
                ? group.memberIds.filter((id) => id !== m.userId)
                : [...group.memberIds, m.userId],
            ),
        };
      })}
    />
  );
}
