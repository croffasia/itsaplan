import { type ReactNode } from 'react';
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
import IssueCustomFieldControl from '../fields/IssueCustomFieldControl';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';
import IssueWatchers from './IssueWatchers';
import IssueSectionHeading from './IssueSectionHeading';
import { type Embeddable } from '../../utils/attachmentEmbed';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// One property row in the two-column list: name on the left, control on the right.
function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="truncate pt-1.5 text-sm text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </>
  );
}

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
}) {
  const t = useTranslations('issue.fields');
  const hasMembers = project.assignees.some((a) => a.kind === 'member');
  const hasAgents = project.assignees.some((a) => a.kind === 'agent');
  const rows = (
    <>
      <PropertyRow label={t('state')}>
        <StatusSelect
          columns={project.columns}
          value={issue.columnId}
          onChange={(id) => onPatch({ columnId: id })}
          readOnly={readOnly}
        />
      </PropertyRow>

      <PropertyRow label={t('priority')}>
        <PrioritySelect
          value={issue.priority ?? ''}
          onChange={(v) => onPatch({ priority: v || null })}
          readOnly={readOnly}
        />
      </PropertyRow>

      {hasMembers && (
        <PropertyRow label={t('assignee')}>
          <AssigneeSelect
            assignees={project.assignees}
            value={issue.assigneeUserId}
            onChange={(userId) => onPatch({ assigneeUserId: userId })}
            readOnly={readOnly}
          />
        </PropertyRow>
      )}

      {hasAgents && (
        <PropertyRow label={t('delegate')}>
          <DelegateSelect
            assignees={project.assignees}
            value={issue.delegateUserId}
            onChange={(userId) => onPatch({ delegateUserId: userId })}
            readOnly={readOnly}
          />
        </PropertyRow>
      )}

      {watchers && (
        <PropertyRow label={t('watching')}>
          <IssueWatchers issueId={issue.id} watchers={watchers} />
        </PropertyRow>
      )}

      {project.issueTypes.length > 0 && (
        <PropertyRow label={t('type')}>
          <TypeSelect
            issueTypes={project.issueTypes}
            value={issue.typeId}
            onChange={(id) => onPatch({ typeId: id })}
            readOnly={readOnly}
          />
        </PropertyRow>
      )}

      {project.labels.length > 0 && (
        <PropertyRow label={t('labels')}>
          <LabelsSelect
            labels={project.labels}
            groups={project.labelGroups}
            value={issue.labelIds}
            onToggle={onToggleLabel}
            readOnly={readOnly}
          />
        </PropertyRow>
      )}

      {project.project.initiativesEnabled && (!readOnly || issue.initiative) && (
        <PropertyRow label={t('initiative')}>
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
        </PropertyRow>
      )}

      {project.project.cyclesEnabled && (!readOnly || issue.cycle) && (
        <PropertyRow label={t('cycle')}>
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
            <CycleSelect
              projectKey={project.project.key}
              value={issue.cycle}
              onChange={(cycle) => onPatch({ cycleId: cycle?.id ?? null })}
            />
          )}
        </PropertyRow>
      )}

      <PropertyRow label={t('startDate')}>
        <DatePill
          value={issue.startDate}
          placeholder={t('startDate')}
          onChange={(v) => onPatch({ startDate: v })}
          readOnly={readOnly}
        />
      </PropertyRow>

      <PropertyRow label={t('dueDate')}>
        <DatePill
          value={issue.dueDate}
          placeholder={t('dueDate')}
          onChange={(v) => onPatch({ dueDate: v })}
          readOnly={readOnly}
        />
      </PropertyRow>

      {/* Custom fields not flagged "show in main info". A markdown field here
          spans both columns as a full-width block; the rest are property rows. */}
      {fieldDefs
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
            <PropertyRow key={def.id} label={def.name}>
              <IssueCustomFieldControl
                def={def}
                current={current}
                saveKey={saveKey}
                onChange={(value) => onSetField(def.id, value)}
                readOnly={readOnly}
              />
            </PropertyRow>
          );
        })}
    </>
  );

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
          {rows}
        </div>
      )}
    </div>
  );
}
