'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeamProject } from '@/lib/api/endpoints/teams';
import { useUpdateTeamProject } from '@/services/projects.service';
import { useTeam } from '@/services/teams.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isValidKey, normalizeKey } from '@/utils/projectKey';

// Renames a project the team owns and edits what it is for. The key trails the
// title, and is a field only while it is not a valid key (see isValidKey).
export default function TeamProjectEditModal({
  teamId,
  project,
  onClose,
}: {
  teamId: number;
  project: TeamProject;
  onClose: () => void;
}) {
  const t = useTranslations('projects.editDialog');
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const keyEditable = !isValidKey(project.key);
  const [key, setKey] = useState(() => normalizeKey(project.key));
  const updateProject = useUpdateTeamProject();
  // Names the team in the header, the same as when the project was created.
  const team = useTeam(teamId);
  const canSubmit = !updateProject.isPending && name.trim() !== '' && key !== '';

  function submit() {
    if (!canSubmit) return;
    updateProject.mutate(
      {
        teamId,
        projectId: project.id,
        projectKey: project.ref,
        patch: {
          name: name.trim(),
          description: description.trim(),
          ...(keyEditable && { key }),
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      title={t('title')}
      scope={
        team && (
          <>
            <Users className="size-3.5" />
            {team.name}
          </>
        )
      }
      crumb={project.key}
      onClose={onClose}
      className="pb-3"
    >
      <div className="flex flex-col gap-3">
        {keyEditable && (
          <div className="space-y-1.5">
            <Label>{t('key')}</Label>
            <Input value={key} onChange={(e) => setKey(normalizeKey(e.target.value))} />
            <p className="text-xs text-muted-foreground">{t('keyHint')}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t('name')}</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('description')}</Label>
          <Textarea
            rows={2}
            className="min-h-20 resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="mt-1 flex justify-end border-t pt-3">
          <Button disabled={!canSubmit} onClick={submit}>
            {t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
