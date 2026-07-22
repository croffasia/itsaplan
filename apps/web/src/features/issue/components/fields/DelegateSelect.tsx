import { CircleDashed } from 'lucide-react';
import type { Assignee } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';

// The agent an issue is delegated to. `assignees` is the project's full candidate
// list; this control filters it to agents. Members are set through AssigneeSelect.
export default function DelegateSelect({
  assignees,
  value,
  onChange,
  placeholder = 'No delegate',
}: {
  assignees: Assignee[];
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
}) {
  const agents = assignees.filter((a) => a.kind === 'agent');
  const delegate = agents.find((a) => a.userId === value);
  return (
    <PopoverPick
      trigger={
        <Pill active={!!delegate}>
          {delegate ? (
            <Avatar name={delegate.name} image={delegate.image} className="size-4 text-[8px]" />
          ) : (
            <CircleDashed />
          )}
          {delegate?.name ?? placeholder}
        </Pill>
      }
      inputPlaceholder="Delegate to…"
      emptyText="No agents."
      items={[
        {
          key: 'none',
          search: 'No delegate',
          icon: <CircleDashed />,
          label: 'No delegate',
          selected: value == null,
          onSelect: () => onChange(null),
        },
        ...agents.map((a) => ({
          key: a.userId,
          search: a.name,
          icon: <Avatar name={a.name} image={a.image} className="size-4 text-[8px]" />,
          label: a.name,
          selected: a.userId === value,
          onSelect: () => onChange(a.userId),
        })),
      ]}
    />
  );
}
