import { type ReactNode } from 'react';
import {
  type CustomField,
  type ProjectDetail,
  type IssueDetail as IssueDetailRow,
  type IssueFieldValueInput,
  type IssuePatch,
} from '@/lib/api';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import DelegateSelect from '../fields/DelegateSelect';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import StatusSelect from '@/components/common/fields/StatusSelect';
import TypeSelect from '@/components/common/fields/TypeSelect';
import InitiativeSelect from '../fields/InitiativeSelect';
import IssueCustomFieldControl from '../fields/IssueCustomFieldControl';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';

// One property row in the two-column list: name on the left, control on the right.
function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="pt-1.5 text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </>
  );
}

// The Properties grid of the issue detail: built-in fields (status, assignee,
// priority, type, dates, labels) and non-markdown custom fields, each editable
// inline. In the page layout it is a bordered card; in the panel a plain block.
export default function IssueProperties({
  project,
  issue,
  fieldDefs,
  onPatch,
  onSetField,
  onToggleLabel,
  uploadFile,
  hasSidebar,
}: {
  project: ProjectDetail;
  issue: IssueDetailRow;
  fieldDefs: CustomField[];
  onPatch: (fields: IssuePatch) => void;
  onSetField: (fieldId: number, value: IssueFieldValueInput) => void;
  onToggleLabel: (id: number) => void;
  uploadFile: (file: File) => Promise<{ url: string; contentType: string; filename: string }>;
  hasSidebar: boolean;
}) {
  const hasMembers = project.assignees.some((a) => a.kind === 'member');
  const hasAgents = project.assignees.some((a) => a.kind === 'agent');
  const rows = (
    <>
      <PropertyRow label="State">
        <StatusSelect
          columns={project.columns}
          value={issue.columnId}
          onChange={(id) => onPatch({ columnId: id })}
        />
      </PropertyRow>

      {hasMembers && (
        <PropertyRow label="Assignee">
          <AssigneeSelect
            assignees={project.assignees}
            value={issue.assigneeUserId}
            onChange={(userId) => onPatch({ assigneeUserId: userId })}
          />
        </PropertyRow>
      )}

      {hasAgents && (
        <PropertyRow label="Delegate">
          <DelegateSelect
            assignees={project.assignees}
            value={issue.delegateUserId}
            onChange={(userId) => onPatch({ delegateUserId: userId })}
          />
        </PropertyRow>
      )}

      <PropertyRow label="Priority">
        <PrioritySelect
          value={issue.priority ?? ''}
          onChange={(v) => onPatch({ priority: v || null })}
        />
      </PropertyRow>

      {project.issueTypes.length > 0 && (
        <PropertyRow label="Type">
          <TypeSelect
            issueTypes={project.issueTypes}
            value={issue.typeId}
            onChange={(id) => onPatch({ typeId: id })}
          />
        </PropertyRow>
      )}

      <PropertyRow label="Initiative">
        <InitiativeSelect
          projectKey={project.project.key}
          value={issue.initiative?.id ?? null}
          onChange={(id) => onPatch({ initiativeId: id })}
        />
      </PropertyRow>

      <PropertyRow label="Start date">
        <DatePill
          value={issue.startDate}
          placeholder="Start date"
          onChange={(v) => onPatch({ startDate: v })}
        />
      </PropertyRow>

      <PropertyRow label="Due date">
        <DatePill
          value={issue.dueDate}
          placeholder="Due date"
          onChange={(v) => onPatch({ dueDate: v })}
        />
      </PropertyRow>

      {project.labels.length > 0 && (
        <PropertyRow label="Labels">
          <LabelsSelect
            labels={project.labels}
            groups={project.labelGroups}
            value={issue.labelIds}
            onToggle={onToggleLabel}
          />
        </PropertyRow>
      )}

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
                  onSetField={onSetField}
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
              />
            </PropertyRow>
          );
        })}
    </>
  );

  const inner = (
    <>
      <h3
        className={`text-xs font-medium text-muted-foreground ${hasSidebar ? 'mb-2.5' : 'mb-3 tracking-wide uppercase'}`}
      >
        Properties
      </h3>
      <div
        className={`grid ${hasSidebar ? 'grid-cols-[72px_1fr] gap-x-2' : 'grid-cols-[110px_1fr] gap-x-3'} items-start gap-y-2.5`}
      >
        {rows}
      </div>
    </>
  );

  // In the page layout the properties become a bordered card in the right
  // sidebar; in the panel they stay a plain block under the content.
  return hasSidebar ? (
    <div className="rounded-lg border bg-card/50 p-3.5">{inner}</div>
  ) : (
    <div className="mt-6 border-t pt-5">{inner}</div>
  );
}
