import { useTranslations } from 'next-intl';
import type { Assignee } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import type { PickItem } from '@/components/common/fields/PopoverPick';
import { isForeignAgent } from '../utils/delegates';

// Builds the row one candidate gets in a picker over the project's people and agents,
// shared by the controls that write such a candidate to an issue. An agent bound to
// someone else runs nothing for you, so it is listed with its owner's avatar and
// cannot be picked.
export function useCandidatePickItem(
  assignees: Assignee[],
  value: string | null,
  onChange: (userId: string) => void,
) {
  const t = useTranslations('issue.fieldSelects');
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const byId = new Map(assignees.map((a) => [a.userId, a]));

  return (a: Assignee): PickItem => {
    const foreign = a.kind === 'agent' && isForeignAgent(a, currentUserId);
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
  };
}
