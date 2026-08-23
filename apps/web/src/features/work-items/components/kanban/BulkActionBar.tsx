'use client';

import { useState } from 'react';
import { Archive, Bot, CircleDashed, RefreshCw, Tag, Target, Trash2, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ProjectDetail } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import { useInitiativeOptionsQuery } from '@/services/initiatives.service';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { subtaskCount } from '@/utils/subtasks';
import { cn } from '@/lib/utils';
import { colorDot } from '@/components/common/fields/colorDot';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useSelection } from '../../context/useSelection';
import { useBulkActions } from '../../hooks/useBulkActions';
import { BarMenu } from './BarMenu';
import { BulkRemovalDialog } from './BulkRemovalDialog';

// Floating bar shown while the kanban board is in selection mode. Each control
// applies one field to every selected issue at once; archive and delete run their
// respective bulk mutations. Selection is kept after a field edit (the applied
// change stays visible and further edits can be chained) and self-empties after
// archive/delete as those issues leave the board.
export function BulkActionBar({ project }: { project: ProjectDetail }) {
  const t = useTranslations('workItems.bulk');
  const tCommon = useTranslations('common');
  const priorityLabel = usePriorityLabel();
  const selection = useSelection();
  const { can } = usePermissions();
  const bulk = useBulkActions(project);
  const [confirming, setConfirming] = useState<'delete' | 'archive' | null>(null);
  // Initiatives are not in the board scaffold. The bulk picker fetches the linkable
  // (open) ones only while selection is active, and only while the project shows the
  // Initiatives section (with none loaded the picker is left out).
  const initiativesKey =
    selection.isSelecting && project.project.initiativesEnabled ? project.project.key : null;
  const { data } = useInitiativeOptionsQuery(initiativesKey);
  const initiatives = data ?? [];

  if (!selection.isSelecting) return null;

  const ids = [...selection.selected];
  const subtasks = subtaskCount(project.issues, ids);
  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const members = project.assignees.filter((a) => a.kind === 'member');
  const agents = project.assignees.filter((a) => a.kind === 'agent');
  const disabled = bulk.pending;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <div
          className={cn(
            'pointer-events-auto flex items-center gap-1 rounded-lg border bg-popover p-1 pl-3 shadow-lg',
            disabled && 'opacity-70',
          )}
        >
          <span className="pr-1 text-sm font-medium whitespace-nowrap">
            {t('selected', { count: ids.length })}
          </span>

          {canEdit && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />

              <BarMenu
                icon={<CircleDashed className="size-4" />}
                label={t('status')}
                disabled={disabled}
              >
                {project.columns.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => void bulk.patch(ids, { columnId: c.id })}
                  >
                    <StateIcon stateType={c.stateType} color={c.color} className="size-3.5" />
                    <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
              </BarMenu>

              <BarMenu icon={PRIORITY_FIELDS[0].icon} label={t('priority')} disabled={disabled}>
                {PRIORITY_FIELDS.map((p) => (
                  <DropdownMenuItem
                    key={p.value || 'none'}
                    onSelect={() => void bulk.patch(ids, { priority: p.value || null })}
                  >
                    {p.icon}
                    <span className="flex-1">{priorityLabel(p.value)}</span>
                  </DropdownMenuItem>
                ))}
              </BarMenu>

              {members.length > 0 && (
                <BarMenu
                  icon={<User className="size-4" />}
                  label={t('assignee')}
                  disabled={disabled}
                >
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { assigneeUserId: null })}>
                    <CircleDashed />
                    <span className="flex-1">{t('noAssignee')}</span>
                  </DropdownMenuItem>
                  {members.map((a) => (
                    <DropdownMenuItem
                      key={a.userId}
                      onSelect={() => void bulk.patch(ids, { assigneeUserId: a.userId })}
                    >
                      <User />
                      <span className="flex-1 truncate">{a.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {agents.length > 0 && (
                <BarMenu
                  icon={<Bot className="size-4" />}
                  label={t('delegate')}
                  disabled={disabled}
                >
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { delegateUserId: null })}>
                    <CircleDashed />
                    <span className="flex-1">{t('noDelegate')}</span>
                  </DropdownMenuItem>
                  {agents.map((a) => (
                    <DropdownMenuItem
                      key={a.userId}
                      onSelect={() => void bulk.patch(ids, { delegateUserId: a.userId })}
                    >
                      <Bot />
                      <span className="flex-1 truncate">{a.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {initiatives.length > 0 && (
                <BarMenu
                  icon={<Target className="size-4" />}
                  label={t('initiative')}
                  disabled={disabled}
                >
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { initiativeId: null })}>
                    <CircleDashed />
                    <span className="flex-1">{t('noInitiative')}</span>
                  </DropdownMenuItem>
                  {initiatives.map((initiative) => (
                    <DropdownMenuItem
                      key={initiative.id}
                      onSelect={() => void bulk.patch(ids, { initiativeId: initiative.id })}
                    >
                      <Target />
                      <span className="flex-1 truncate">{initiative.title}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {project.plannedCycles.length > 0 && (
                <BarMenu
                  icon={<RefreshCw className="size-4" />}
                  label={t('cycle')}
                  disabled={disabled}
                >
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { cycleId: null })}>
                    <CircleDashed />
                    <span className="flex-1">{t('noCycle')}</span>
                  </DropdownMenuItem>
                  {project.plannedCycles.map((cycle) => (
                    <DropdownMenuItem
                      key={cycle.id}
                      onSelect={() => void bulk.patch(ids, { cycleId: cycle.id })}
                    >
                      {colorDot(CYCLE_STATUS_META[cycle.status].color)}
                      <span className="flex-1 truncate">{cycle.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {project.labels.length > 0 && (
                <BarMenu icon={<Tag className="size-4" />} label={t('labels')} disabled={disabled}>
                  {project.labels.map((l) => (
                    <DropdownMenuItem
                      key={l.id}
                      // Keep the menu open so several labels can be added in one pass.
                      onSelect={(e) => {
                        e.preventDefault();
                        void bulk.addLabel(ids, l.id);
                      }}
                    >
                      {colorDot(l.color)}
                      <span className="flex-1 truncate">{l.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                disabled={disabled}
                onClick={() => {
                  // Only an archive that has subtasks to ask about is confirmed.
                  if (subtasks > 0) setConfirming('archive');
                  else void bulk.archiveAll(ids);
                }}
              >
                <Archive className="size-4" />
                {t('archive')}
              </Button>
            </>
          )}

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => setConfirming('delete')}
            >
              <Trash2 className="size-4" />
              {tCommon('delete')}
            </Button>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={selection.clear}
                aria-label={t('clearSelection')}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('clearSelection')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {confirming && (
        <BulkRemovalDialog
          projectKey={project.project.key}
          action={confirming}
          ids={ids}
          subtaskCount={subtasks}
          onConfirm={(disposition) =>
            confirming === 'delete'
              ? bulk.deleteAll(ids, disposition)
              : bulk.archiveAll(ids, disposition)
          }
          onClose={() => setConfirming(null)}
        />
      )}
    </>
  );
}
