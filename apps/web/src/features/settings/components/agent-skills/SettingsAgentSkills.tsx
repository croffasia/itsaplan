import { useState } from 'react';
import type { AgentSkill, ProjectDetail } from '@/lib/api';
import { AGENT_SKILLS_SECTION } from '@/utils/settingsSections';
import { useSkillsQuery, useDeleteSkill } from '@/services/agentSkills.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsListEmpty } from '../crud/SettingsListEmpty';
import { useSettingsCan } from '../../context/settingsPermission';
import { SkillEditDialog } from './SkillEditDialog';
import { SkillRow } from './SkillRow';

// Project settings for the agent skill library: reusable instructions given to
// internal agents. A skill is a SKILL.md plus optional reference files; it can be
// written inline, uploaded, or imported from GitHub. Creating opens a dialog;
// editing opens a separate dialog that also manages reference files.
export default function SettingsAgentSkills({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const skillsQuery = useSkillsQuery(projectKey);
  const skills = skillsQuery.data ?? [];
  const deleteSkill = useDeleteSkill(projectKey);
  const can = useSettingsCan();

  const [editing, setEditing] = useState<AgentSkill | null>(null);
  const [deleting, setDeleting] = useState<AgentSkill | null>(null);

  return (
    <>
      {skills.length === 0 ? (
        <SettingsListEmpty
          icon={AGENT_SKILLS_SECTION.icon}
          title="No skills yet"
          description="Add a skill: reusable instructions an internal agent loads on demand. Write markdown, upload a file, or import from GitHub."
        />
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
                <TableHead className="text-xs font-medium text-muted-foreground">Skill</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  Actions
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
          title="Delete skill"
          confirmLabel="Delete skill"
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
