import { type ReactNode } from 'react';
import { Calendar as CalendarIcon, Clock, Hash, RefreshCw, Target } from 'lucide-react';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type {
  IssueDetail as IssueDetailRow,
  IssueFieldValueInput,
  IssuePatch,
  IssueWatcher,
} from '@/lib/api/endpoints/issues';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import { FIELD_TYPE_ICONS } from '@/components/common/fields/fieldTypeIcons';
import { Pill } from '@/components/common/fields/Pill';
import ReadOnlyPill from '@/components/common/fields/ReadOnlyPill';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import StatusSelect from '@/components/common/fields/StatusSelect';
import TypeSelect from '@/components/common/fields/TypeSelect';
import { type Embeddable } from '@/components/common/editor/attachmentEmbed';
import { parseDate } from '@/utils/dates';
import { fieldSaveKey, hasFieldValue } from '../utils/fieldValues';
import { assignableMembers } from '@/utils/project';
import DelegateSelect from '../components/fields/DelegateSelect';
import InitiativeSelect from '../components/fields/InitiativeSelect';
import CycleSelect from '../components/fields/CycleSelect';
import CycleHistoryBadge from '../components/fields/CycleHistoryBadge';
import EstimatePill from '../components/fields/EstimatePill';
import IssueTimeTracking from '../components/fields/IssueTimeTracking';
import IssueCustomFieldControl from '../components/fields/IssueCustomFieldControl';
import IssueCustomFieldBody from '../components/fields/IssueCustomFieldBody';
import IssueWatchers from '../components/detail/IssueWatchers';
import { useTranslations } from 'next-intl';

export type IssuePropertyGroupKey =
  'groupState' | 'groupPeople' | 'groupPlanning' | 'groupLabels' | 'groupCustom';

// One property of the issue and its editor. A 'pill' control names its field by its
// own value or placeholder, so it reads without the name beside it; a 'named' one
// needs the name; a 'block' is a markdown field that takes the full width.
export interface IssuePropertyRowSpec {
  key: string | number;
  label: string;
  kind: 'pill' | 'named' | 'block';
  node: ReactNode;
  // Set on a row that can be left out while it holds nothing: a custom field, and a
  // built-in field few issues use. True when it holds a value.
  filled?: boolean;
  custom?: boolean;
  // What names the field in the menu that adds a left-out row.
  icon?: ReactNode;
}

export interface IssuePropertyGroup {
  key: IssuePropertyGroupKey;
  rows: IssuePropertyRowSpec[];
}

export interface IssuePropertyRowsInput {
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
  // The row whose editor opens on mount: the one the person has just added.
  openKey?: string | number | null;
  // True where every row sits beside its name (the Properties grid), so an empty
  // control says "No priority" rather than naming its field a second time.
  named?: boolean;
}

// The issue's properties, built-in fields and custom fields, each with its editor,
// grouped the way the Properties grid shows them. A field the project does not use
// is left out, and so is a group left with nothing in it. The grid and the pill row
// of the side panel lay out the same rows.
export function useIssuePropertyRows({
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
  openKey,
  named,
}: IssuePropertyRowsInput): IssuePropertyGroup[] {
  const t = useTranslations('issue.fields');
  const tPriority = useTranslations('common.priority');
  const hasMembers =
    assignableMembers(project.assignees).length > 0 || issue.assigneeUserId != null;
  const hasAgents = project.assignees.some((a) => a.kind === 'agent');
  // The calendars grey out days that would put one date on the wrong side of the
  // other: the start no later than the due date, the due date no earlier than the
  // start. Equal dates are allowed.
  const latestStart = parseDate(issue.dueDate);
  const earliestDue = parseDate(issue.startDate);

  const groups: { key: IssuePropertyGroupKey; rows: (IssuePropertyRowSpec | false)[] }[] = [
    {
      key: 'groupState',
      rows: [
        {
          key: 'state',
          label: t('state'),
          kind: 'pill',
          node: (
            <StatusSelect
              columns={project.columns}
              value={issue.columnId}
              onChange={(id) => onPatch({ columnId: id })}
              readOnly={readOnly}
            />
          ),
        },
        {
          key: 'priority',
          label: t('priority'),
          kind: 'pill',
          node: (
            <PrioritySelect
              value={issue.priority ?? ''}
              onChange={(v) => onPatch({ priority: v || null })}
              readOnly={readOnly}
              placeholder={named ? tPriority('none') : undefined}
            />
          ),
        },
        project.issueTypes.length > 0 && {
          key: 'type',
          label: t('type'),
          kind: 'pill',
          node: (
            <TypeSelect
              issueTypes={project.issueTypes}
              value={issue.typeId}
              onChange={(id) => onPatch({ typeId: id })}
              readOnly={readOnly}
            />
          ),
        },
      ],
    },
    {
      key: 'groupPeople',
      rows: [
        hasMembers && {
          key: 'assignee',
          label: t('assignee'),
          kind: 'pill',
          node: (
            <AssigneeSelect
              assignees={project.assignees}
              value={issue.assigneeUserId}
              onChange={(userId) => onPatch({ assigneeUserId: userId })}
              readOnly={readOnly}
            />
          ),
        },
        hasAgents && {
          key: 'delegate',
          label: t('delegate'),
          kind: 'pill',
          node: (
            <DelegateSelect
              assignees={project.assignees}
              value={issue.delegateUserId}
              onChange={(userId) => onPatch({ delegateUserId: userId })}
              readOnly={readOnly}
            />
          ),
        },
        watchers != null && {
          key: 'watching',
          label: t('watching'),
          kind: 'pill',
          node: (
            <IssueWatchers
              issueId={issue.id}
              watchers={watchers}
              members={project.assignees.filter(
                (assignee) => assignee.kind === 'member' && assignee.canReadWorkItems,
              )}
              canManage={!readOnly}
            />
          ),
        },
      ],
    },
    {
      key: 'groupPlanning',
      rows: [
        project.project.initiativesEnabled &&
          (!readOnly || issue.initiative != null) && {
            key: 'initiative',
            label: t('initiative'),
            kind: 'pill',
            filled: issue.initiative != null,
            icon: <Target />,
            node: readOnly ? (
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
                projectKey={project.project.ref}
                value={issue.initiative?.id ?? null}
                onChange={(id) => onPatch({ initiativeId: id })}
                defaultOpen={openKey === 'initiative'}
              />
            ),
          },
        project.project.cyclesEnabled &&
          (!readOnly || issue.cycle != null) && {
            key: 'cycle',
            label: t('cycle'),
            kind: 'pill',
            filled: issue.cycle != null,
            icon: <RefreshCw />,
            node: readOnly ? (
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
                  projectKey={project.project.ref}
                  value={issue.cycle}
                  onChange={(cycle) => onPatch({ cycleId: cycle?.id ?? null })}
                  defaultOpen={openKey === 'cycle'}
                />
                <CycleHistoryBadge issueId={issue.id} />
              </div>
            ),
          },
        project.project.pointsEstimateEnabled && {
          key: 'estimatePoints',
          label: t('estimatePoints'),
          kind: 'pill',
          filled: issue.estimatePoints != null,
          icon: <Hash />,
          node: (
            <EstimatePill
              kind="points"
              value={issue.estimatePoints}
              onChange={(v) => onPatch({ estimatePoints: v })}
              readOnly={readOnly}
              defaultEditing={openKey === 'estimatePoints'}
            />
          ),
        },
        project.project.timeEstimateEnabled && {
          key: 'estimateTime',
          label: t('estimateTime'),
          kind: 'pill',
          filled: issue.estimateMinutes != null,
          icon: <Clock />,
          node: (
            <EstimatePill
              kind="time"
              value={issue.estimateMinutes}
              onChange={(v) => onPatch({ estimateMinutes: v })}
              readOnly={readOnly}
              defaultEditing={openKey === 'estimateTime'}
            />
          ),
        },
        project.project.timeLoggingEnabled &&
          issue.loggedMinutes > 0 && {
            key: 'timeTracking',
            label: t('timeTracking'),
            kind: 'named',
            node: (
              <IssueTimeTracking
                logged={issue.loggedMinutes}
                estimate={project.project.timeEstimateEnabled ? issue.estimateMinutes : null}
              />
            ),
          },
        {
          key: 'startDate',
          label: t('startDate'),
          kind: 'pill',
          filled: issue.startDate != null,
          icon: <CalendarIcon />,
          node: (
            <DatePill
              value={issue.startDate}
              placeholder={named ? t('empty') : t('startDate')}
              onChange={(v) => onPatch({ startDate: v })}
              readOnly={readOnly}
              disabled={latestStart ? { after: latestStart } : undefined}
              defaultOpen={openKey === 'startDate'}
            />
          ),
        },
        {
          key: 'dueDate',
          label: t('dueDate'),
          kind: 'pill',
          node: (
            <DatePill
              value={issue.dueDate}
              placeholder={named ? t('noDueDate') : t('dueDate')}
              onChange={(v) => onPatch({ dueDate: v })}
              readOnly={readOnly}
              disabled={earliestDue ? { before: earliestDue } : undefined}
            />
          ),
        },
      ],
    },
    {
      key: 'groupLabels',
      rows: [
        project.labels.length > 0 && {
          key: 'labels',
          label: t('labels'),
          kind: 'pill',
          node: (
            <LabelsSelect
              labels={project.labels}
              groups={project.labelGroups}
              value={issue.labelIds}
              onToggle={onToggleLabel}
              readOnly={readOnly}
            />
          ),
        },
      ],
    },
    {
      key: 'groupCustom',
      rows: fieldDefs
        .filter((def) => !def.showInBody)
        .map((def): IssuePropertyRowSpec => {
          const current = issue.fields.find((f) => f.fieldId === def.id);
          const saveKey = fieldSaveKey(def.id, current);
          const Icon = FIELD_TYPE_ICONS[def.fieldType];
          const field = { filled: hasFieldValue(current), custom: true, icon: <Icon /> };
          if (def.fieldType === 'markdown') {
            return {
              key: def.id,
              label: def.name,
              kind: 'block',
              ...field,
              node: (
                <IssueCustomFieldBody
                  def={def}
                  current={current}
                  assignees={project.assignees}
                  saveKey={saveKey}
                  uploadFile={uploadFile}
                  imageAttachments={imageAttachments}
                  onSetField={onSetField}
                  readOnly={readOnly}
                  mentions={{ projectKey: project.project.ref, on: 'issue', place: 'text' }}
                />
              ),
            };
          }
          return {
            key: def.id,
            label: def.name,
            kind: 'named',
            ...field,
            node: (
              <IssueCustomFieldControl
                def={def}
                current={current}
                assignees={project.assignees}
                saveKey={saveKey}
                onChange={(value) => onSetField(def.id, value)}
                readOnly={readOnly}
                defaultOpen={def.id === openKey}
              />
            ),
          };
        }),
    },
  ];

  return groups
    .map((group) => ({
      key: group.key,
      rows: group.rows.filter((row): row is IssuePropertyRowSpec => row !== false),
    }))
    .filter((group) => group.rows.length > 0);
}
