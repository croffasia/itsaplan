'use client';

import { useTranslations } from 'next-intl';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { DOCUMENT_ACCESS_ICON } from '../../utils/documentAccess';

// Who can open the page, for someone who may not change it.
export default function DocumentAccessReadOnly({ document }: { document: ProjectDocument }) {
  const t = useTranslations('documents');
  const { data: session } = useSession();
  const { project } = useShell();
  const { can } = usePermissions();
  const me = session?.user.id ?? null;
  const assignees = project?.assignees ?? [];
  const owner = assignees.find((a) => a.userId === document.ownerUserId);
  const visibility = document.visibility;
  const Icon = DOCUMENT_ACCESS_ICON[visibility];

  let title: string;
  if (visibility === 'public')
    title = t('access.everyoneIn', { project: project?.project.name ?? '' });
  else if (visibility === 'restricted') title = t('access.specificPeople');
  else if (owner && owner.userId !== me) title = t('access.onlyPerson', { name: owner.name });
  else title = t('access.onlyYou');
  const people =
    visibility === 'restricted'
      ? [document.ownerUserId, ...document.memberIds]
          .map((userId) => assignees.find((a) => a.userId === userId))
          .filter((person) => person != null)
      : [];
  let note: string;
  if (!can('documents', 'edit')) note = t('access.roleCannotChange');
  else if (owner) note = t('access.ownerCanChange', { name: owner.name });
  else note = t('access.pageOwnerCanChange');

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      </div>
      {people.length > 0 && (
        <ul className="mt-1 max-h-60 overflow-y-auto overscroll-contain">
          {people.map((person) => (
            <li key={person.userId} className="flex min-h-9 items-center gap-2.5 text-sm">
              <Avatar name={person.name} image={person.image} />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {person.userId === me ? t('access.you') : person.name}
              </span>
              {person.userId === document.ownerUserId ? (
                <span className="text-xs text-muted-foreground">{t('owner')}</span>
              ) : (
                person.kind === 'agent' && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                    {t('access.agent')}
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2.5 text-[13px] leading-[1.45] text-muted-foreground">{note}</p>
    </>
  );
}
