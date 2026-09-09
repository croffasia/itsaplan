import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Initiative, InitiativeStatus } from '@/lib/api/endpoints/initiatives';
import { initiativePath } from '@/utils/paths';
import { parseDate } from '@/utils/dates';
import { useCreateInitiative, useUpdateInitiative } from '@/services/initiatives.service';
import { useProjectQuery } from '@/services/projects.service';
import Modal, { useModalFullscreen } from './Modal';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import InitiativeStatusSelect from '@/components/common/fields/InitiativeStatusSelect';
import MarkdownEditor from '@/components/common/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// An initiative's fields, laid out as the new-issue dialog is: title, description,
// then the properties as pills. With `initiative` it edits that one, otherwise it
// creates one and — without onCreated — navigates to it.
export default function InitiativeDialog({
  projectKey,
  initiative,
  onClose,
  onCreated,
}: {
  projectKey: string;
  initiative?: Initiative;
  onClose: () => void;
  onCreated?: (id: number) => void;
}) {
  const t = useTranslations('initiatives');
  const tCommon = useTranslations('common');
  // Already in the cache: the Shell loads it for the project the dialog opens in.
  const { data: project } = useProjectQuery(projectKey);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initiative?.title ?? '');
  const [description, setDescription] = useState(initiative?.description ?? '');
  const [status, setStatus] = useState<InitiativeStatus>(initiative?.status ?? 'planned');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(initiative?.ownerUserId ?? null);
  const [priority, setPriority] = useState(initiative?.priority ?? '');
  const [startDate, setStartDate] = useState<string | null>(initiative?.startDate ?? null);
  const [targetDate, setTargetDate] = useState<string | null>(initiative?.targetDate ?? null);
  const [labelIds, setLabelIds] = useState<number[]>(initiative?.labelIds ?? []);
  const { fullscreen, onToggleFullscreen } = useModalFullscreen();
  const create = useCreateInitiative(projectKey);
  const update = useUpdateInitiative(projectKey);
  const router = useRouter();

  const saving = create.isPending || update.isPending;
  const busyLabel = initiative ? tCommon('saving') : t('form.creating');
  const idleLabel = initiative ? t('form.save') : t('form.create');
  const submitLabel = saving ? busyLabel : idleLabel;

  // The calendars grey out days that would put one date on the wrong side of the
  // other. Equal dates are allowed.
  const latestStart = parseDate(targetDate);
  const earliestTarget = parseDate(startDate);

  const toggleLabel = (labelId: number) =>
    setLabelIds((ids) =>
      ids.includes(labelId) ? ids.filter((id) => id !== labelId) : [...ids, labelId],
    );

  const submit = async () => {
    const name = title.trim();
    if (!name) return;
    const fields = {
      title: name,
      description: description.trim(),
      status,
      ownerUserId,
      priority: priority || null,
      startDate,
      targetDate,
      labelIds,
    };
    if (initiative) {
      await update.mutateAsync({ id: initiative.id, patch: fields });
      onClose();
      return;
    }
    const created = await create.mutateAsync(fields);
    onClose();
    if (onCreated) onCreated(created.id);
    else router.push(initiativePath(projectKey, created.id));
  };

  return (
    <Modal
      title={initiative ? t('form.editTitle') : t('newInitiative')}
      scope={projectKey}
      onClose={onClose}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        titleRef.current?.focus();
      }}
      wide
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    >
      <div className={cn('flex min-h-0 flex-col', fullscreen && 'flex-1 overflow-hidden')}>
        <input
          ref={titleRef}
          // `auto` once there is something to read, so a title keeps the script it
          // was typed in.
          dir={title ? 'auto' : undefined}
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
          placeholder={t('form.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={cn('flex min-h-0 flex-col overflow-hidden', fullscreen && 'flex-1')}>
          <MarkdownEditor
            // In fullscreen the editor claims the leftover height; in compact it
            // grows with its content and scrolls once the dialog runs out of room.
            className={cn('mt-3 overflow-y-auto', fullscreen ? 'min-h-48 flex-1' : 'min-h-24')}
            defaultValue={initiative?.description ?? ''}
            placeholder={t('form.descriptionPlaceholder')}
            onChange={setDescription}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <InitiativeStatusSelect value={status} onChange={setStatus} />

          {project?.assignees.some((a) => a.kind === 'member') && (
            <AssigneeSelect
              assignees={project.assignees}
              value={ownerUserId}
              onChange={setOwnerUserId}
              placeholder={t('noOwner')}
            />
          )}

          <PrioritySelect value={priority} onChange={setPriority} />

          <DatePill
            value={startDate}
            placeholder={t('startDate')}
            onChange={setStartDate}
            disabled={latestStart ? { after: latestStart } : undefined}
          />

          <DatePill
            value={targetDate}
            placeholder={t('targetDate')}
            onChange={setTargetDate}
            disabled={earliestTarget ? { before: earliestTarget } : undefined}
          />

          {project && project.labels.length > 0 && (
            <LabelsSelect
              labels={project.labels}
              groups={project.labelGroups}
              value={labelIds}
              onToggle={toggleLabel}
            />
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button disabled={!title.trim() || saving} onClick={() => void submit()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
