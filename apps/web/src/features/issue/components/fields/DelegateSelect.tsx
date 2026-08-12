import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  placeholder,
  readOnly,
}: {
  assignees: Assignee[];
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const none = t('noDelegate');
  const agents = assignees.filter((a) => a.kind === 'agent');
  const delegate = agents.find((a) => a.userId === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!delegate}>
          {delegate ? (
            <Avatar name={delegate.name} image={delegate.image} className="size-4 text-[8px]" />
          ) : (
            <CircleDashed />
          )}
          {delegate?.name ?? placeholder ?? none}
        </Pill>
      }
      inputPlaceholder={t('delegateTo')}
      emptyText={t('noAgents')}
      items={[
        {
          key: 'none',
          search: none,
          icon: <CircleDashed />,
          label: none,
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
