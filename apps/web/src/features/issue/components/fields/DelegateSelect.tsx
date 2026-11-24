import { type ReactNode } from 'react';
import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Assignee } from '@/lib/api/endpoints/projects';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';
import { useCandidatePickItem } from '../../hooks/useCandidatePickItem';

// The agent an issue is delegated to. `assignees` is the project's full candidate
// list; this control filters it to agents. Members are set through AssigneeSelect.
export default function DelegateSelect({
  assignees,
  value,
  onChange,
  placeholder,
  readOnly,
  trigger,
}: {
  assignees: Assignee[];
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  readOnly?: boolean;
  // Replaces the pill where a caller needs its own (a Timeline cell).
  trigger?: ReactNode;
}) {
  const t = useTranslations('issue.fieldSelects');
  const none = t('noDelegate');
  const agents = assignees.filter((a) => a.kind === 'agent');
  const delegate = agents.find((a) => a.userId === value);
  const toItem = useCandidatePickItem(assignees, value, onChange);

  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        trigger ?? (
          <Pill active={!!delegate}>
            {delegate ? (
              <Avatar name={delegate.name} image={delegate.image} className="size-4 text-[8px]" />
            ) : (
              <CircleDashed />
            )}
            <span className="truncate">{delegate?.name ?? placeholder ?? none}</span>
          </Pill>
        )
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
        ...agents.map(toItem),
      ]}
    />
  );
}
