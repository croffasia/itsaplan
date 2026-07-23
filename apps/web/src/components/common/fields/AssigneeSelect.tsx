import { CircleDashed } from 'lucide-react';
import type { Assignee } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Pill } from './Pill';
import PopoverPick, { type PickItem } from './PopoverPick';

// The assignee of an issue is a project member. `assignees` is the project's full
// candidate list (members and agents); this control filters it to members. Agents
// are set through DelegateSelect instead. The signed-in member is pulled out into a
// "Team me" group at the top; everyone else falls under "Members".
export default function AssigneeSelect({
  assignees,
  value,
  onChange,
  placeholder = 'No assignee',
  readOnly,
}: {
  assignees: Assignee[];
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const members = assignees.filter((a) => a.kind === 'member');
  const assignee = members.find((a) => a.userId === value);

  const toItem = (a: Assignee): PickItem => ({
    key: a.userId,
    search: a.name,
    icon: <Avatar name={a.name} image={a.image} className="size-4 text-[8px]" />,
    label: a.name,
    selected: a.userId === value,
    onSelect: () => onChange(a.userId),
  });
  const me = members.find((a) => a.userId === currentUserId);
  const others = members.filter((a) => a.userId !== currentUserId);

  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!assignee}>
          {assignee ? (
            <Avatar name={assignee.name} image={assignee.image} className="size-4 text-[8px]" />
          ) : (
            <CircleDashed />
          )}
          {assignee?.name ?? placeholder}
        </Pill>
      }
      inputPlaceholder="Assign to…"
      emptyText="No members."
      items={[
        {
          key: 'none',
          search: 'No assignee',
          icon: <CircleDashed />,
          label: 'No assignee',
          selected: value == null,
          onSelect: () => onChange(null),
        },
      ]}
      groups={[
        ...(me ? [{ heading: 'Team me', items: [toItem(me)] }] : []),
        { heading: 'Members', items: others.map(toItem) },
      ]}
    />
  );
}
