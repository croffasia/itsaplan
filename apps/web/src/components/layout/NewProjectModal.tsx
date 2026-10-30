import { useState, type ReactNode } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCreateProject } from '@/services/projects.service';
import { useTeamsQuery, useTeamProjectDefaultsQuery } from '@/services/teams.service';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import { useProjectTemplatesQuery } from '@/services/projectTemplates.service';
import { useCopyColumns } from '@/hooks/useCopyColumns';
import { includeOf, type CopyInclude } from '@/utils/copyOptions';
import { normalizeKey, suggestKey } from '@/utils/projectKey';
import type { PresetKey } from '@/utils/projectPresets';
import Modal from '@/components/common/overlay/Modal';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import CopyProjectForm from '@/components/layout/CopyProjectForm';
import NewProjectDetails from '@/components/layout/NewProjectDetails';
import NewProjectFields from '@/components/layout/NewProjectFields';
import NewProjectPreset from '@/components/layout/NewProjectPreset';
import NewProjectStart from '@/components/layout/NewProjectStart';

// Creates a project, from scratch or from one of the team's templates, or — when
// `copyFrom` is set — copies that project's structure (states, issue types, labels,
// custom fields) into a new project without its issues. `teamId` is the team the project
// belongs to; a copy is always made within the source project's team. While the team has
// templates, creating takes two steps: what the project starts from, then its fields;
// `initialTemplateId` opens the second step with that template picked.
export default function NewProjectModal({
  onClose,
  onCreated,
  teamId,
  copyFrom,
  initialTemplateId,
}: {
  onClose: () => void;
  onCreated: (projectKey: string) => void;
  teamId: number;
  copyFrom?: { id: number; name: string; description: string };
  initialTemplateId?: number;
}) {
  const t = useTranslations('newProject');
  const tCommon = useTranslations('common');
  const initialName = copyFrom ? t('copyName', { name: copyFrom.name }) : '';
  const [key, setKey] = useState(() => suggestKey(initialName));
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(copyFrom?.description ?? '');
  // Once the user edits the key, stop deriving it from the name. Clearing the
  // key field resumes auto-generation.
  const [keyEdited, setKeyEdited] = useState(false);
  // Which parts of the source project to copy. Defaults to everything; the user
  // clears what they don't want.
  const copyColumns = useCopyColumns();
  const [include, setInclude] = useState<CopyInclude>({});
  // Which issue types the new project starts with. A copy takes its types from the
  // source project, and a project from a template from the template, so the preset
  // applies only when creating from scratch.
  const [preset, setPreset] = useState<PresetKey>('general');
  const [templateId, setTemplateId] = useState<number | null>(initialTemplateId ?? null);
  const [step, setStep] = useState<'start' | 'details'>(
    initialTemplateId != null ? 'details' : 'start',
  );
  const templatesQuery = useProjectTemplatesQuery(copyFrom ? null : teamId);
  // The list is for the team's owners and managers; anyone it is refused to starts
  // from scratch.
  const templates = templatesQuery.isError ? [] : templatesQuery.data;
  const template = templates?.find((one) => one.id === templateId);
  const twoSteps = !copyFrom && templates !== undefined && templates.length > 0;
  const choosing = twoSteps && step === 'start';
  const createProject = useCreateProject();
  // Names the team in the header, so the dialog says where the project lands.
  const teams = useTeamsQuery().data;
  const team = teams?.find((one) => one.id === teamId);
  const defaults = useTeamProjectDefaultsQuery(copyFrom ? null : teamId).data;
  const agents = useAiAgentsQuery(copyFrom ? null : teamId).data ?? [];
  const defaultAgentNames = agents
    .filter((agent) => defaults?.defaultAgentIds.includes(agent.id))
    .map((agent) => agent.name);

  function onNameChange(value: string) {
    setName(value);
    if (!keyEdited) setKey(suggestKey(value));
  }

  function onKeyChange(value: string) {
    const next = normalizeKey(value);
    setKey(next);
    setKeyEdited(next !== '');
  }

  function submit() {
    const input = {
      key: key.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      ...(copyFrom
        ? { include: includeOf(copyColumns, include) }
        : template
          ? { templateId: template.id }
          : { preset }),
    };
    createProject.mutate(
      { teamId, copyFromId: copyFrom?.id, input },
      { onSuccess: (project) => onCreated(project.ref) },
    );
  }

  const fields = (
    <NewProjectFields
      name={name}
      projectKey={key}
      description={description}
      onNameChange={onNameChange}
      onKeyChange={onKeyChange}
      onDescriptionChange={setDescription}
    />
  );
  const presetPicker = <NewProjectPreset value={preset} onChange={setPreset} />;

  let body: ReactNode;
  if (copyFrom) {
    body = (
      <CopyProjectForm
        name={name}
        projectKey={key}
        description={description}
        columns={copyColumns}
        include={include}
        onNameChange={onNameChange}
        onKeyChange={onKeyChange}
        onDescriptionChange={setDescription}
        onIncludeChange={setInclude}
      />
    );
  } else if (!templates) {
    body = <ListSkeleton rows={4} rowClassName="h-10" />;
  } else if (!twoSteps) {
    body = (
      <div className="grid gap-6 sm:grid-cols-[1.15fr_1fr]">
        {fields}
        {presetPicker}
      </div>
    );
  } else if (choosing) {
    body = (
      <NewProjectStart
        teamId={teamId}
        templates={templates}
        templateId={templateId}
        onTemplateChange={setTemplateId}
        blank={presetPicker}
      />
    );
  } else {
    body = (
      <NewProjectDetails
        start={template?.name ?? `${t('blank')} · ${t(`presets.${preset}`)}`}
        onChange={() => setStep('start')}
      >
        {fields}
      </NewProjectDetails>
    );
  }

  return (
    <Modal
      title={copyFrom ? t('copyTitle', { name: copyFrom.name }) : t('title')}
      scope={
        team && (
          <>
            <Users className="size-3.5" />
            {team.name}
          </>
        )
      }
      onClose={onClose}
      wide="xl"
      className="pb-3"
    >
      <div className="flex min-h-0 flex-col">
        {/* On a short viewport the form scrolls on its own so the submit button
            stays in place instead of sitting below the fold. */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {body}
          {!copyFrom && !choosing && defaultAgentNames.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t('defaultAgents', { names: defaultAgentNames.join(', ') })}
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
          {twoSteps && !choosing && (
            <Button variant="ghost" className="me-auto" onClick={() => setStep('start')}>
              <ArrowLeft className="rtl:rotate-180" />
              {tCommon('back')}
            </Button>
          )}
          {choosing ? (
            <Button onClick={() => setStep('details')}>{t('continue')}</Button>
          ) : (
            <Button
              disabled={createProject.isPending || !key.trim() || !name.trim()}
              onClick={submit}
            >
              {t(copyFrom ? 'copyAction' : 'create')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
