import { Fragment, type ReactNode } from 'react';
import { RefreshCw, Target } from 'lucide-react';
import {
  type CustomField,
  type ProjectDetail,
  type IssueDetail as IssueDetailRow,
  type IssueFieldValueInput,
  type IssuePatch,
  type IssueWatcher,
} from '@/lib/api';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import { Pill } from '@/components/common/fields/Pill';
import ReadOnlyPill from '@/components/common/fields/ReadOnlyPill';
import DelegateSelect from '../fields/DelegateSelect';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import StatusSelect from '@/components/common/fields/StatusSelect';
import TypeSelect from '@/components/common/fields/TypeSelect';
import InitiativeSelect from '../fields/InitiativeSelect';
import CycleSelect from '../fields/CycleSelect';
import CycleHistoryBadge from '../fields/CycleHistoryBadge';
import EstimatePill from '../fields/EstimatePill';
import IssueTimeTracking from '../fields/IssueTimeTracking';
import IssueCustomFieldControl from '../fields/IssueCustomFieldControl';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';
import IssueWatchers from './IssueWatchers';
import IssueSectionHeading from './IssueSectionHeading';
import IssuePropertyRow from './IssuePropertyRow';
import IssuePropertyGroupHeading from './IssuePropertyGroupHeading';
import { type Embeddable } from '../../utils/attachmentEmbed';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// The Properties grid of the issue detail: built-in fields and non-markdown
// custom fields, each editable inline. Shaped like the Attachments and Links
// sections — same heading, same separator above it, same collapsing — in the
// sidebar and in the single column alike.
export default function IssueProperties({
  project,
  issue,
  fieldDefs,
  onPatch,
  onSetField,
  onToggleLabel,
  uploadFile,
  imageAttachments,
  watchers,
  readOnly,
  className,
  open,
  onToggle,
  groupsOpen,
}: {
  project: ProjectDetail;
  issue: IssueDetailRow;
  fieldDefs: CustomField[];
  onPatch: (fields: IssuePatch) => void;
  onSetField: (fieldId: number, value: IssueFieldValueInput) => void;
  onToggleLabel: (id: number) => void;
  uploadFile?: (file: File) => Promise<Embeddable>;
  imageAttachments?: Embeddable[];
  // Who follows the issue. Absent on the public shared page, which does not expose
  // them and has nobody to subscribe.
  watchers?: IssueWatcher[];
  // When true every control is a non-interactive display of its value (public
  // shared page, or a member without work_items edit). The
  // onPatch/onSetField/onToggleLabel callbacks are never called.
  readOnly?: boolean;
  // Spacing override for a sidebar, where the section follows the actions row
  // rather than a block of content and needs less room above it.
  className?: string;
  // Held by the parent: the page layout renders this section twice — in the
  // column below xl, in the sidebar from xl — and both have to agree.
  open: boolean;
  onToggle: () => void;
  // Which property groups are open, held by the parent for the same reason.
  groupsOpen: { isOpen: (key: string) => boolean; toggle: (key: string) => void };
}) {
  const t = useTranslations('issue.fields');
  const hasMembers = project.assignees.some((a) => a.kind === 'member');
  const hasAgents = project.assignees.some((a) => a.kind === 'agent');
  const groups: {
    key: 'groupState' | 'groupPeople' | 'groupPlanning' | 'groupLabels' | 'groupCustom';
    rows: ReactNode[];
  }[] = [
    {
      key: 'groupState',
      rows: [
        <IssuePropertyRow key="state" label={t('state')}>
          <StatusSelect
            columns={project.columns}
            value={issue.columnId}
            onChange={(id) => onPatch({ columnId: id })}
            readOnly={readOnly}
          />
        </IssuePropertyRow>,

        <IssuePropertyRow key="priority" label={t('priority')}>
          <PrioritySelect
            value={issue.priority ?? ''}
            onChange={(v) => onPatch({ priority: v || null })}
            readOnly={readOnly}
          />
        </IssuePropertyRow>,

        project.issueTypes.length > 0 && (
          <IssuePropertyRow key="type" label={t('type')}>
            <TypeSelect
              issueTypes={project.issueTypes}
              value={issue.typeId}
              onChange={(id) => onPatch({ typeId: id })}
              readOnly={readOnly}
            />
          </IssuePropertyRow>
        ),
      ],
    },
    {
      key: 'groupPeople',
      rows: [
        hasMembers && (
          <IssuePropertyRow key="assignee" label={t('assignee')}>
            <AssigneeSelect
              assignees={project.assignees}
              value={issue.assigneeUserId}
              onChange={(userId) => onPatch({ assigneeUserId: userId })}
              readOnly={readOnly}
            />
          </IssuePropertyRow>
        ),

        hasAgents && (
          <IssuePropertyRow key="delegate" label={t('delegate')}>
            <DelegateSelect
              assignees={project.assignees}
              value={issue.delegateUserId}
              onChange={(userId) => onPatch({ delegateUserId: userId })}
              readOnly={readOnly}
            />
          </IssuePropertyRow>
        ),

        watchers && (
          <IssuePropertyRow key="watching" label={t('watching')}>
            <IssueWatchers
              issueId={issue.id}
              watchers={watchers}
              members={project.assignees.filter(
                (assignee) => assignee.kind === 'member' && assignee.canReadWorkItems,
              )}
              canManage={!readOnly}
            />
          </IssuePropertyRow>
        ),
      ],
    },
    {
      key: 'groupPlanning',
      rows: [
        project.project.initiativesEnabled && (!readOnly || issue.initiative) && (
          <IssuePropertyRow key="initiative" label={t('initiative')}>
            {readOnly ? (
              // Read-only shows the linked initiative from the issue itself, avoiding
              // the authenticated initiatives query the editable select runs.
              <ReadOnlyPill>
                <Pill active={!!issue.initiative}>
                  <Target />
                  <span className="truncate">{issue.initiative?.title ?? t('initiative')}</span>
                </Pill>
              </ReadOnlyPill>
            ) : (
              <InitiativeSelect
                projectKey={project.project.key}
                value={issue.initiative?.id ?? null}
                onChange={(id) => onPatch({ initiativeId: id })}
              />
            )}
          </IssuePropertyRow>
        ),

        project.project.cyclesEnabled && (!readOnly || issue.cycle) && (
          <IssuePropertyRow key="cycle" label={t('cycle')}>
            {readOnly ? (
              // Read-only shows the cycle from the issue itself, avoiding the
              // authenticated cycles query the editable select runs.
              <ReadOnlyPill>
                <Pill active={!!issue.cycle}>
                  <RefreshCw />
                  <span className="truncate">{issue.cycle?.name ?? t('cycle')}</span>
                </Pill>
              </ReadOnlyPill>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <CycleSelect
                  projectKey={project.project.key}
                  value={issue.cycle}
                  onChange={(cycle) => onPatch({ cycleId: cycle?.id ?? null })}
                />
                <CycleHistoryBadge issueId={issue.id} />
              </div>
            )}
          </IssuePropertyRow>
        ),

        project.project.pointsEstimateEnabled && (
          <IssuePropertyRow key="estimatePoints" label={t('estimatePoints')}>
            <EstimatePill
              kind="points"
              value={issue.estimatePoints}
              onChange={(v) => onPatch({ estimatePoints: v })}
              readOnly={readOnly}
            />
          </IssuePropertyRow>
        ),

        project.project.timeEstimateEnabled && (
          <IssuePropertyRow key="estimateTime" label={t('estimateTime')}>
            <EstimatePill
              kind="time"
              value={issue.estimateMinutes}
              onChange={(v) => onPatch({ estimateMinutes: v })}
              readOnly={readOnly}
            />
          </IssuePropertyRow>
        ),

        project.project.timeLoggingEnabled && issue.loggedMinutes > 0 && (
          <IssuePropertyRow key="timeTracking" label={t('timeTracking')}>
            <IssueTimeTracking
              logged={issue.loggedMinutes}
              estimate={project.project.timeEstimateEnabled ? issue.estimateMinutes : null}
            />
          </IssuePropertyRow>
        ),

        <IssuePropertyRow key="startDate" label={t('startDate')}>
          <DatePill
            value={issue.startDate}
            placeholder={t('startDate')}
            onChange={(v) => onPatch({ startDate: v })}
            readOnly={readOnly}
          />
        </IssuePropertyRow>,

        <IssuePropertyRow key="dueDate" label={t('dueDate')}>
          <DatePill
            value={issue.dueDate}
            placeholder={t('dueDate')}
            onChange={(v) => onPatch({ dueDate: v })}
            readOnly={readOnly}
          />
        </IssuePropertyRow>,
      ],
    },
    {
      key: 'groupLabels',
      rows: [
        project.labels.length > 0 && (
          <IssuePropertyRow key="labels" label={t('labels')}>
            <LabelsSelect
              labels={project.labels}
              groups={project.labelGroups}
              value={issue.labelIds}
              onToggle={onToggleLabel}
              readOnly={readOnly}
            />
          </IssuePropertyRow>
        ),
      ],
    },
    {
      key: 'groupCustom',
      rows: fieldDefs
        .filter((def) => !def.showInBody)
        .map((def) => {
          const current = issue.fields.find((f) => f.fieldId === def.id);
          const saveKey = `${def.id}-${issue.updatedAt}`;
          if (def.fieldType === 'markdown') {
            return (
              <div key={def.id} className="col-span-2">
                <IssueCustomFieldBody
                  def={def}
                  current={current}
                  assignees={project.assignees}
                  saveKey={saveKey}
                  uploadFile={uploadFile}
                  imageAttachments={imageAttachments}
                  onSetField={onSetField}
                  readOnly={readOnly}
                />
              </div>
            );
          }
          return (
            <IssuePropertyRow key={def.id} label={def.name}>
              <IssueCustomFieldControl
                def={def}
                current={current}
                assignees={project.assignees}
                saveKey={saveKey}
                onChange={(value) => onSetField(def.id, value)}
                readOnly={readOnly}
              />
            </IssuePropertyRow>
          );
        }),
    },
  ];

  const visibleGroups = groups
    .map((group) => ({ ...group, rows: group.rows.filter(Boolean) }))
    .filter((group) => group.rows.length > 0);

  return (
    // Collapsed, the heading row is all there is, so the section pulls itself up
    // against the one below it.
    <div className={cn('mt-6 border-t pt-5', !open && '-mb-2', className)}>
      <IssueSectionHeading
        label={t('properties')}
        open={open}
        onToggle={onToggle}
        className={cn('h-7', open && 'mb-3')}
      />
      {open && (
        // The name column takes a share of whatever room the section has, capped at
        // the width long names need, so a narrow sidebar leaves the controls enough
        // space instead of pushing them out of it.
        <div className="grid grid-cols-[minmax(0,min(40%,180px))_minmax(0,1fr)] items-start gap-x-2 gap-y-2.5">
          {visibleGroups.map((group, i) => {
            const groupOpen = groupsOpen.isOpen(group.key);
            return (
              <Fragment key={group.key}>
                <IssuePropertyGroupHeading
                  label={t(group.key)}
                  className={cn(i > 0 && 'mt-2')}
                  open={groupOpen}
                  onToggle={() => groupsOpen.toggle(group.key)}
                />
                {groupOpen && group.rows}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
