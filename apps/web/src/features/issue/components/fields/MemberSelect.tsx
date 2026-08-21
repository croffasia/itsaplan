import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Assignee, MemberScope } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';
import { memberCandidates } from '@/utils/memberFields';
import { useCandidatePickItem } from '../../hooks/useCandidatePickItem';

// The candidates the field's scope offers, listed with the people before the agents.
function candidates(assignees: Assignee[], scope: MemberScope): Assignee[] {
  const offered = memberCandidates(assignees, scope);
  return [
    ...offered.filter((a) => a.kind === 'member'),
    ...offered.filter((a) => a.kind === 'agent'),
  ];
}

// The person or agent a member custom field holds. Which of them the field offers is
// its scope, chosen when the field was created. Shaped like AssigneeSelect and
// DelegateSelect, which do the same for the built-in fields.
export default function MemberSelect({
  assignees,
  scope,
  value,
  onChange,
  placeholder,
}: {
  assignees: Assignee[];
  scope: MemberScope;
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
}) {
  const t = useTranslations('issue.fieldSelects');
  const none = t('noMember');
  const options = candidates(assignees, scope);
  const selected = options.find((a) => a.userId === value);
  const toItem = useCandidatePickItem(assignees, value, onChange);

  return (
    <PopoverPick
      trigger={
        <Pill active={!!selected}>
          {selected ? (
            <Avatar name={selected.name} image={selected.image} className="size-4 text-[8px]" />
          ) : (
            <CircleDashed />
          )}
          <span className="truncate">{selected?.name ?? placeholder ?? none}</span>
        </Pill>
      }
      inputPlaceholder={t('pickMember')}
      emptyText={t('noCandidates')}
      items={[
        {
          key: 'none',
          search: none,
          icon: <CircleDashed />,
          label: none,
          selected: value == null,
          onSelect: () => onChange(null),
        },
        ...options.map(toItem),
      ]}
    />
  );
}
