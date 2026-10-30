'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TeamProject } from '@/lib/api/endpoints/teams';
import { useSaveProjectTemplate } from '@/services/projectTemplates.service';
import Modal from '@/components/common/overlay/Modal';
import { useCopyColumns } from '@/hooks/useCopyColumns';
import { includeOf, type CopyInclude } from '@/utils/copyOptions';
import CopyProjectOptions from '@/components/layout/CopyProjectOptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Saves the chosen parts of a project's configuration as a project template of the team.
// Only what a template carries is offered.
export default function TeamProjectTemplateModal({
  teamId,
  project,
  onClose,
}: {
  teamId: number;
  project: TeamProject;
  onClose: () => void;
}) {
  const t = useTranslations('projects.saveTemplate');
  const tNew = useTranslations('newProject');
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const columns = useCopyColumns(true);
  const [include, setInclude] = useState<CopyInclude>({});
  const save = useSaveProjectTemplate(teamId);

  function submit() {
    save.mutate(
      {
        projectId: project.id,
        name: name.trim(),
        description: description.trim(),
        include: includeOf(columns, include),
      },
      {
        onSuccess: (template) => {
          toast.success(t('saved', { name: template.name }));
          onClose();
        },
      },
    );
  }

  return (
    <Modal title={t('title', { name: project.name })} onClose={onClose} wide="xl" className="pb-3">
      <div className="flex min-h-0 flex-col">
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground">{t('hint')}</p>
          <div className="space-y-1.5">
            <Label>{tNew('name')}</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tNew('description')}</Label>
            <Textarea
              rows={2}
              className="resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <CopyProjectOptions columns={columns} value={include} onChange={setInclude} />
        </div>
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button disabled={save.isPending || !name.trim()} onClick={submit}>
            {t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
