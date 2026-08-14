import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Assignee } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';
import { isForeignAgent } from '../../utils/delegates';

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
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const none = t('noDelegate');
  const agents = assignees.filter((a) => a.kind === 'agent');
  const delegate = agents.find((a) => a.userId === value);
  const byId = new Map(assignees.map((a) => [a.userId, a]));

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
        ...agents.map((a) => {
          // An agent bound to someone else runs nothing for you, so it is listed with
          // its owner's avatar and cannot be picked.
          const foreign = isForeignAgent(a, currentUserId);
          const owner = a.restrictedToUserId ? byId.get(a.restrictedToUserId) : undefined;
          const ownerLabel = owner
            ? t('delegateOwnedBy', { name: owner.name })
            : t('delegateOwnedByOther');
          return {
            key: a.userId,
            search: a.name,
            icon: <Avatar name={a.name} image={a.image} className="size-4 text-[8px]" />,
            label: a.name,
            selected: a.userId === value,
            trailing: foreign ? (
              <Avatar
                name={owner?.name ?? ''}
                image={owner?.image ?? null}
                className="size-4 text-[8px]"
              />
            ) : undefined,
            tooltip: foreign ? ownerLabel : undefined,
            disabled: foreign,
            onSelect: () => onChange(a.userId),
          };
        }),
      ]}
    />
  );
}
