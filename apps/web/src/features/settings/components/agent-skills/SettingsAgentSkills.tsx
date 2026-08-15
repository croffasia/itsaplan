import { useState } from 'react';
import type { AgentSkill, ProjectDetail } from '@/lib/api';
import { useSkillsQuery, useDeleteSkill } from '@/services/agentSkills.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { useSettingsCan } from '../../context/settingsPermission';
import { SkillEditDialog } from './SkillEditDialog';
import { SkillRow } from './SkillRow';
import { useTranslations } from 'next-intl';

// Project settings for the agent skill library: reusable instructions given to
// internal agents. A skill is a SKILL.md plus optional reference files; it can be
// written inline, uploaded, or imported from GitHub. Creating opens a dialog;
// editing opens a separate dialog that also manages reference files.
export default function SettingsAgentSkills({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.skills');
  const tCommon = useTranslations('common');
  const projectKey = project.project.key;
  const skillsQuery = useSkillsQuery(projectKey);
  const skills = skillsQuery.data ?? [];
  const deleteSkill = useDeleteSkill(projectKey);
  const can = useSettingsCan();

  const [editing, setEditing] = useState<AgentSkill | null>(null);
  const [deleting, setDeleting] = useState<AgentSkill | null>(null);

  return (
    <>
      {skillsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : skills.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
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
              {skills.map((s) => (
                <SkillRow
                  key={s.id}
                  skill={s}
                  canEdit={can('edit')}
                  canDelete={can('delete')}
                  onEdit={() => setEditing(s)}
                  onDelete={() => setDeleting(s)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <SkillEditDialog
          projectKey={projectKey}
          skill={editing}
          canEdit={can('edit')}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          message={
            <>
              Delete the skill “{deleting.name}”? It will be removed from every agent that uses it.
            </>
          }
          onConfirm={async () => {
            await deleteSkill.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
