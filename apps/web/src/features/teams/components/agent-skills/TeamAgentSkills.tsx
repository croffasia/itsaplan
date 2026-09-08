import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api/endpoints/roles';
import type { AgentSkill } from '@/lib/api/endpoints/agentSkills';
import { useSkillsPageQuery, useDeleteSkill } from '@/services/agentSkills.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { SkillEditDialog } from './SkillEditDialog';
import { SkillRow } from './SkillRow';

// The team's skill library as a table: reusable instructions the internal agents of
// its projects load on demand. A skill is a SKILL.md plus optional reference files;
// it can be written inline, uploaded, or imported from GitHub. Editing opens a
// separate dialog that also manages the reference files.
export default function TeamAgentSkills({
  teamId,
  teamName,
  permissions,
}: {
  teamId: number;
  teamName: string;
  permissions: ResourcePermissions;
}) {
  const t = useTranslations('teams.skills');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState<AgentSkill | null>(null);
  const [deleting, setDeleting] = useState<AgentSkill | null>(null);
  const paging = usePaging();

  const skillsQuery = useSkillsPageQuery(teamId, paging.params);
  const skills = skillsQuery.data?.items ?? [];
  const total = skillsQuery.data?.total ?? 0;
  const deleteSkill = useDeleteSkill(teamId);

  return (
    <>
      {skillsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : total === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table className="min-w-[820px] table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[58%]" />
                <col className="w-[14%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('skill')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('description')}
                  </TableHead>
                  <TableHead className="text-end text-xs font-medium text-muted-foreground">
                    {tCommon('actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    canEdit={permissions.edit}
                    canDelete={permissions.delete}
                    onEdit={() => setEditing(skill)}
                    onDelete={() => setDeleting(skill)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPager paging={paging} total={total} />
        </div>
      )}

      {editing && (
        <SkillEditDialog
          teamId={teamId}
          teamName={teamName}
          skill={editing}
          canEdit={permissions.edit}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          onConfirm={async () => {
            await deleteSkill.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <div className="text-sm text-muted-foreground">
            {t('deleteMessage', { name: deleting.name })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
