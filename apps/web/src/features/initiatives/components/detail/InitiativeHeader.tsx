'use client';

import { Info } from 'lucide-react';
import type { Initiative, InitiativePatch, ProjectDetail } from '@/lib/api';
import { useUpdateInitiative } from '@/services/initiatives.service';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import InitiativeStatusSelect from '../shared/InitiativeStatusSelect';
import HealthBadge from '../shared/HealthBadge';
import HealthInfoPopover from '../shared/HealthInfoPopover';
import ProgressBar from '../shared/ProgressBar';
import InitiativeActions from './InitiativeActions';

// The initiative detail header. The pills patch the initiative inline; title and
// description are read-only here and edited from the overflow menu dialog.
export default function InitiativeHeader({
  initiative,
  project,
}: {
  initiative: Initiative;
  project: ProjectDetail;
}) {
  const update = useUpdateInitiative(project.project.key);
  const hasDescription = initiative.description.trim().length > 0;

  const patch = (p: InitiativePatch) => update.mutate({ id: initiative.id, patch: p });

  const toggleLabel = (labelId: number) => {
    const next = initiative.labelIds.includes(labelId)
      ? initiative.labelIds.filter((id) => id !== labelId)
      : [...initiative.labelIds, labelId];
    patch({ labelIds: next });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{initiative.title}</span>
          {hasDescription && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Show description"
                  className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                >
                  <Info className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80">
                <div className="text-sm font-semibold">{initiative.title}</div>
                <p className="mt-1.5 max-h-64 overflow-y-auto text-sm whitespace-pre-wrap text-muted-foreground">
                  {initiative.description}
                </p>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        <InitiativeStatusSelect
          value={initiative.status}
          onChange={(status) => patch({ status })}
        />
        <AssigneeSelect
          assignees={project.assignees}
          value={initiative.ownerUserId}
          onChange={(ownerUserId) => patch({ ownerUserId })}
          placeholder="No owner"
        />
        <PrioritySelect
          value={initiative.priority ?? ''}
          onChange={(v) => patch({ priority: v || null })}
        />
        <DatePill
          value={initiative.targetDate}
          placeholder="Target date"
          onChange={(v) => patch({ targetDate: v })}
        />
        <LabelsSelect
          labels={project.labels}
          groups={project.labelGroups}
          value={initiative.labelIds}
          onToggle={toggleLabel}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1">
          <HealthInfoPopover />
          <HealthBadge health={initiative.health} />
        </div>
        <ProgressBar progress={initiative.progress} />
        <InitiativeActions initiative={initiative} projectKey={project.project.key} />
      </div>
    </div>
  );
}
