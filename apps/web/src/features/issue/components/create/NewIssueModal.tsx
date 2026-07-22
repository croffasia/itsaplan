import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { type IssueFieldValueInput, type ProjectDetail } from '@/lib/api';
import { type NewIssueDefaults } from '@/utils/project';
import { useSession } from '@/lib/auth-client';
import { useCreateIssue, useSetFieldValue } from '@/services/issues.service';
import { useCustomFieldsQuery } from '@/services/customFields.service';
import IssueCustomFieldPill from '../fields/IssueCustomFieldPill';
import Modal from '@/components/common/overlay/Modal';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import DelegateSelect from '../fields/DelegateSelect';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import StatusSelect from '@/components/common/fields/StatusSelect';
import TypeSelect from '@/components/common/fields/TypeSelect';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pill } from '@/components/common/fields/Pill';
import InitiativeSelect from '../fields/InitiativeSelect';

export default function NewIssueModal({
  project,
  defaults,
  onClose,
  onCreated,
}: {
  project: ProjectDetail;
  defaults: NewIssueDefaults;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(defaults.columnId);
  const [typeId, setTypeId] = useState<number | null>(
    defaults.typeId === undefined
      ? (project.issueTypes.find((t) => t.isDefault)?.id ?? null)
      : defaults.typeId,
  );
  const [initiativeId, setInitiativeId] = useState<number | null>(defaults.initiativeId ?? null);
  const { data: session } = useSession();
  // Assignee defaults to the creating user unless the caller set one explicitly
  // (defaults.assigneeUserId is null for the "No assignee" board group).
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(() => {
    if (defaults.assigneeUserId !== undefined) return defaults.assigneeUserId;
    const userId = session?.user.id;
    return userId != null &&
      project.assignees.some((a) => a.kind === 'member' && a.userId === userId)
      ? userId
      : null;
  });
  const [delegateUserId, setDelegateUserId] = useState<string | null>(
    defaults.delegateUserId ?? null,
  );
  const [priority, setPriority] = useState(defaults.priority ?? '');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [labelIds, setLabelIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Custom fields for the selected type (global + type-scoped). Fields flagged
  // "show in main info" render below the description; the rest are added on
  // demand from the "…" menu.
  const fieldsQuery = useCustomFieldsQuery(project.project.key, typeId ?? undefined);
  const fieldDefs = fieldsQuery.data ?? [];
  const [activeFieldIds, setActiveFieldIds] = useState<number[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<number, IssueFieldValueInput>>({});
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  const createIssue = useCreateIssue();
  const setFieldValueMutation = useSetFieldValue(project.project.key);

  const [addFieldOpen, setAddFieldOpen] = useState(false);

  // Drop shown fields that no longer apply to the selected type. Nothing is shown
  // by default — the user adds fields from the "…" menu.
  useEffect(() => {
    const valid = new Set(fieldDefs.filter((d) => !d.showInBody).map((d) => d.id));
    setActiveFieldIds((prev) => prev.filter((id) => valid.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsQuery.data]);

  const bodyDefs = fieldDefs.filter((d) => d.showInBody);
  const propertyDefs = fieldDefs.filter((d) => !d.showInBody);
  const activeDefs = propertyDefs.filter((d) => activeFieldIds.includes(d.id));
  const availableDefs = propertyDefs.filter((d) => !activeFieldIds.includes(d.id));

  function toggleLabel(id: number) {
    setLabelIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function setFieldValue(id: number, patch: IssueFieldValueInput) {
    setFieldValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const created = await createIssue.mutateAsync({
        projectKey: project.project.key,
        input: {
          title: title.trim(),
          description: description.trim() || undefined,
          columnId,
          typeId,
          initiativeId,
          assigneeUserId,
          delegateUserId,
          priority: priority || null,
          startDate: startDate || null,
          dueDate: dueDate || null,
          labelIds,
        },
      });
      // Set custom field values on the freshly created issue. Body fields are
      // always applicable; property fields only if the user added them.
      for (const def of fieldDefs) {
        if (!def.showInBody && !activeFieldIds.includes(def.id)) continue;
        const v = fieldValues[def.id];
        if (!v) continue;
        const hasValue = (v.optionIds?.length ?? 0) > 0 || (v.value != null && v.value !== '');
        if (!hasValue) continue;
        await setFieldValueMutation.mutateAsync({ issueId: created.id, fieldId: def.id, value: v });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New issue" projectKey={project.project.key} onClose={onClose} wide>
      <div>
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
          placeholder="Issue title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <IssueMarkdownEditor
          className={`mt-3 ${bodyDefs.length > 0 ? 'min-h-14' : 'min-h-24'}`}
          defaultValue={description}
          onChange={setDescription}
        />

        {bodyDefs.length > 0 && (
          <div className="mt-2 space-y-4">
            {bodyDefs.map((def) => (
              <div key={def.id}>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {def.name}
                </h3>
                {def.fieldType === 'markdown' ? (
                  <IssueMarkdownEditor
                    defaultValue={(fieldValues[def.id]?.value as string) ?? ''}
                    placeholder="Empty"
                    onChange={(md) => setFieldValue(def.id, { value: md })}
                  />
                ) : (
                  <IssueCustomFieldPill
                    def={def}
                    value={fieldValues[def.id]}
                    onChange={(v) => setFieldValue(def.id, v)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={`${bodyDefs.length > 0 ? 'mt-8' : 'mt-4'} flex flex-wrap items-center gap-2`}
        >
          <StatusSelect columns={project.columns} value={columnId} onChange={setColumnId} />

          {project.assignees.some((a) => a.kind === 'member') && (
            <AssigneeSelect
              assignees={project.assignees}
              value={assigneeUserId}
              onChange={setAssigneeUserId}
              placeholder="Assignee"
            />
          )}

          {project.assignees.some((a) => a.kind === 'agent') && (
            <DelegateSelect
              assignees={project.assignees}
              value={delegateUserId}
              onChange={setDelegateUserId}
              placeholder="Delegate"
            />
          )}

          <PrioritySelect value={priority} onChange={setPriority} />

          {project.issueTypes.length > 0 && (
            <TypeSelect issueTypes={project.issueTypes} value={typeId} onChange={setTypeId} />
          )}

          <InitiativeSelect
            projectKey={project.project.key}
            value={initiativeId}
            onChange={setInitiativeId}
          />

          {project.labels.length > 0 && (
            <LabelsSelect
              labels={project.labels}
              groups={project.labelGroups}
              value={labelIds}
              onToggle={toggleLabel}
            />
          )}

          <DatePill
            value={startDate || null}
            placeholder="Start date"
            onChange={(v) => setStartDate(v ?? '')}
          />

          <DatePill
            value={dueDate || null}
            placeholder="Due date"
            onChange={(v) => setDueDate(v ?? '')}
          />

          {/* Custom fields the user added, each with its own value editor. */}
          {activeDefs.map((def) => (
            <IssueCustomFieldPill
              key={def.id}
              def={def}
              value={fieldValues[def.id]}
              defaultOpen={def.id === justAddedId}
              onChange={(v) => setFieldValue(def.id, v)}
            />
          ))}

          {/* "…" menu to add a custom field to this issue. */}
          {availableDefs.length > 0 && (
            <Popover open={addFieldOpen} onOpenChange={setAddFieldOpen}>
              <PopoverTrigger asChild>
                <Pill>
                  <MoreHorizontal />
                </Pill>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Add field…" />
                  <CommandList>
                    <CommandEmpty>No fields.</CommandEmpty>
                    <CommandGroup>
                      {availableDefs.map((def) => (
                        <CommandItem
                          key={def.id}
                          value={def.name}
                          onSelect={() => {
                            setActiveFieldIds((ids) => [...ids, def.id]);
                            setJustAddedId(def.id);
                            setAddFieldOpen(false);
                          }}
                        >
                          <span className="flex-1">{def.name}</span>
                          <span className="text-xs text-muted-foreground">{def.fieldType}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-4 flex items-center justify-end border-t pt-3">
          <Button disabled={saving || !title.trim()} onClick={submit}>
            Create issue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
