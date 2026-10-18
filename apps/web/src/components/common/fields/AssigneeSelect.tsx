import { CircleDashed } from 'lucide-react';
import type { ProjectGroup } from '@/lib/api/endpoints/groups';
import type { Assignee } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import GroupAvatar from './GroupAvatar';
import { Pill } from './Pill';
import PopoverPick, { type PickItem } from './PopoverPick';
import { useTranslations } from 'next-intl';

// The assignee of an issue is a project member. `assignees` is the project's full
// candidate list (members and agents); this control filters it to members. Agents
// are set through DelegateSelect instead. The signed-in member is pulled out into a
// "Team me" group at the top; everyone else falls under "Members". Given `groups` and
// `onGroupChange`, a "Groups" section follows: picking a group sets it beside the
// person, and picking the chosen group again clears it.
export default function AssigneeSelect({
  assignees,
  value,
  onChange,
  groups = [],
  groupValue = null,
  onGroupChange,
  placeholder,
  readOnly,
}: {
  assignees: Assignee[];
  value: string | null;
  onChange: (userId: string | null) => void;
  groups?: ProjectGroup[];
  groupValue?: number | null;
  onGroupChange?: (groupId: number | null) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const none = t('noAssignee');
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const members = assignees.filter((a) => a.kind === 'member');
  const assignee = members.find((a) => a.userId === value);
  const group = groups.find((g) => g.id === groupValue);

  const toItem = (a: Assignee): PickItem => ({
    key: a.userId,
    search: a.name,
    icon: <Avatar name={a.name} image={a.image} className="size-4 text-[8px]" />,
    label: a.name,
    selected: a.userId === value,
    onSelect: () => onChange(a.userId),
  });
  const toGroupItem = (g: ProjectGroup): PickItem => ({
    key: `group-${g.id}`,
    search: g.name,
    icon: <GroupAvatar group={g} className="size-4" />,
    label: g.name,
    selected: g.id === groupValue,
    onSelect: () => onGroupChange?.(g.id === groupValue ? null : g.id),
  });
  const me = members.find((a) => a.userId === currentUserId);
  const others = members.filter((a) => a.userId !== currentUserId);

  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!assignee || !!group}>
          {assignee ? (
            <Avatar name={assignee.name} image={assignee.image} className="size-4 text-[8px]" />
          ) : group ? (
            <GroupAvatar group={group} className="size-4" />
          ) : (
            <CircleDashed />
          )}
          <span className="truncate">{assignee?.name ?? group?.name ?? placeholder ?? none}</span>
          {assignee && group && <GroupAvatar group={group} className="size-4" />}
        </Pill>
      }
      inputPlaceholder={t('assignTo')}
      emptyText={t('noMembers')}
      items={[
        {
          key: 'none',
          search: none,
          icon: <CircleDashed />,
          label: none,
          selected: value == null,
          onSelect: () => onChange(null),
        },
      ]}
      groups={[
        ...(me ? [{ heading: t('you'), items: [toItem(me)] }] : []),
        { heading: t('members'), items: others.map(toItem) },
        ...(onGroupChange ? [{ heading: t('groups'), items: groups.map(toGroupItem) }] : []),
      ]}
    />
  );
}
