import { useEffect, useRef, useState } from 'react';
import { type Editor } from '@tiptap/react';
import { MoreHorizontal } from 'lucide-react';
import { type IssueFieldValueInput, type ProjectDetail } from '@/lib/api';
import { type NewIssueDefaults } from '@/utils/project';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { useCreateIssue, useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import { useCustomFieldsQuery } from '@/services/customFields.service';
import { useFileDragZone } from '../../hooks/useFileDragZone';
import { useNewIssueAttachments } from '../../hooks/useNewIssueAttachments';
import {
  attachmentHtml,
  removeEmbed,
  replaceEmbed,
  stripEmbed,
  type Embeddable,
} from '../../utils/attachmentEmbed';
import { DESCRIPTION_SECTION, OTHER_SECTION, fieldSectionId } from '../../utils/bodySections';
import { hasFieldValue } from '../../utils/fieldValues';
import IssueCustomFieldPill from '../fields/IssueCustomFieldPill';
import NewIssueAttachButton from './NewIssueAttachButton';
import NewIssueAttachmentStrip from './NewIssueAttachmentStrip';
import NewIssueDropOverlay from './NewIssueDropOverlay';
import Modal from '@/components/common/overlay/Modal';
import NewIssueBody from './NewIssueBody';
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
  const [title, setTitle] = useState(defaults.title ?? '');
  const [description, setDescription] = useState(defaults.description ?? '');
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
  const [fullscreen, setFullscreen] = useState(false);

  // Custom fields for the selected type (global + type-scoped). Fields flagged
  // "show in main info" get their own body section; the rest are added on demand from
  // the "…" menu.
  const fieldsQuery = useCustomFieldsQuery(project.project.key, typeId ?? undefined);
  const fieldDefs = fieldsQuery.data ?? [];
  const [activeFieldIds, setActiveFieldIds] = useState<number[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<number, IssueFieldValueInput>>({});
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue(project.project.key);
  const setFieldValueMutation = useSetFieldValue(project.project.key);
  const attachments = useNewIssueAttachments();

  // The description editor instance, so a file dropped or pasted anywhere on the
  // modal (not just onto the editor box) can be inserted at the cursor.
  const [descEditor, setDescEditor] = useState<Editor | null>(null);

  // The markdown editors of the body custom fields, so an attachment removed
  // from the strip takes its embeds with it wherever they were inserted.
  const fieldEditors = useRef(new Map<number, Editor>());

  // Which of the body sections is open, so an attachment lands in the editor the
  // user is looking at.
  const [bodySection, setBodySection] = useState(DESCRIPTION_SECTION);

  function activeBodyEditor(): Editor | null {
    if (bodySection === DESCRIPTION_SECTION) return descEditor;
    const fieldId = fieldSectionId(bodySection);
    return fieldId === null ? null : (fieldEditors.current.get(fieldId) ?? null);
  }

  function insertIntoBody(a: Embeddable) {
    activeBodyEditor()?.chain().focus().insertContent(attachmentHtml(a)).run();
  }

  function removeAttachment(id: number) {
    const item = attachments.remove(id);
    if (!item) return;
    if (descEditor) removeEmbed(descEditor, item.url);
    for (const editor of fieldEditors.current.values()) removeEmbed(editor, item.url);
  }

  // The annotated image replaces the file it was drawn on, so wherever that file
  // was already inserted now shows the annotated one.
  function annotateAttachment(id: number, file: File) {
    const urls = attachments.replace(id, file);
    if (!urls) return;
    if (descEditor) replaceEmbed(descEditor, urls.from, urls.to);
    for (const editor of fieldEditors.current.values()) replaceEmbed(editor, urls.from, urls.to);
  }

  function insertFilesIntoBody(files: FileList) {
    const editor = activeBodyEditor();
    // No editor on screen: still attach the files, they can be inserted later.
    if (!editor) {
      attachments.attach(files);
      return;
    }
    let pos = editor.state.selection.to;
    void (async () => {
      for (const file of Array.from(files)) {
        const a = await attachments.uploadFile(file).catch(() => null);
        if (!a) continue;
        editor.chain().insertContentAt(pos, attachmentHtml(a)).focus().run();
        pos = editor.state.selection.to;
      }
    })();
  }

  const { draggedFiles, dragHandlers } = useFileDragZone(insertFilesIntoBody);

  // Read through a ref: the paste listener below is registered once, while the
  // insert closes over the editor and the upload limits, which both arrive after
  // the first render.
  const insertFilesRef = useRef(insertFilesIntoBody);
  insertFilesRef.current = insertFilesIntoBody;

  // A paste carrying files lands in the open section's editor unless a markdown editor
  // has the focus, in which case tiptap has already inserted it there. The listener
  // is on the document because the focus may sit on the dialog itself, above the
  // modal body.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const target = e.target;
      if (target instanceof Element && target.closest('.ProseMirror')) return;
      e.preventDefault();
      insertFilesRef.current(files);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const [addFieldOpen, setAddFieldOpen] = useState(false);

  // Drop shown fields that no longer apply to the selected type. Nothing is shown
  // by default — the user adds fields from the "…" menu.
  useEffect(() => {
    const valid = new Set(fieldDefs.filter((d) => !d.showInBody).map((d) => d.id));
    setActiveFieldIds((prev) => prev.filter((id) => valid.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsQuery.data]);

  const errorMessage = error ?? attachments.error;
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
          parentId: defaults.parentId ?? null,
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
      // Upload the pending files, then point every embed at its stored URL
      // instead of the local blob: one.
      const storedUrls = await attachments.uploadAll(created.id);
      const rewrite = (markdown: string) => {
        let out = markdown;
        for (const [blobUrl, url] of storedUrls) {
          out = url ? out.replaceAll(blobUrl, url) : stripEmbed(out, blobUrl);
        }
        return out;
      };

      const body = rewrite(description);
      if (body !== description) {
        await updateIssue.mutateAsync({ id: created.id, patch: { description: body.trim() } });
      }

      // Set custom field values on the freshly created issue. Body fields are
      // always applicable; property fields only if the user added them.
      for (const def of fieldDefs) {
        if (!def.showInBody && !activeFieldIds.includes(def.id)) continue;
        const v = fieldValues[def.id];
        if (!hasFieldValue(v)) continue;
        const value = typeof v.value === 'string' ? { ...v, value: rewrite(v.value) } : v;
        await setFieldValueMutation.mutateAsync({ issueId: created.id, fieldId: def.id, value });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New issue"
      projectKey={project.project.key}
      onClose={onClose}
      wide
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
      // Halves the dialog's bottom padding: the footer then sits as far from the
      // separator above it as from the dialog edge below.
      className="pb-3"
    >
      <div
        className={cn('flex min-h-0 flex-col', fullscreen && 'flex-1 overflow-hidden')}
        {...dragHandlers}
      >
        {/* Not inside a relative box on purpose: the dialog itself is the
            positioned ancestor, so the overlay covers the whole modal. */}
        {draggedFiles !== null && <NewIssueDropOverlay count={draggedFiles} />}
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
          placeholder="Issue title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        {/* The written content is the one part that gives up height, so the pills
            and the footer stay in view however much of it there is. It scrolls
            inside its editors, not here, which keeps the switcher in place. */}
        <div className={cn('flex min-h-0 flex-col overflow-hidden', fullscreen && 'flex-1')}>
          <NewIssueBody
            section={bodySection}
            onSectionChange={setBodySection}
            fullscreen={fullscreen}
            description={description}
            onDescriptionChange={setDescription}
            onDescriptionReady={setDescEditor}
            bodyDefs={bodyDefs}
            fieldValues={fieldValues}
            onFieldValue={setFieldValue}
            onFieldEditorReady={(id, editor) => {
              if (editor) fieldEditors.current.set(id, editor);
              else fieldEditors.current.delete(id);
            }}
            uploadFile={attachments.uploadFile}
          />
        </div>

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

          {project.project.initiativesEnabled && (
            <InitiativeSelect
              projectKey={project.project.key}
              value={initiativeId}
              onChange={setInitiativeId}
            />
          )}

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

        {errorMessage && <p className="mt-3 text-xs text-destructive">{errorMessage}</p>}

        <div className="mt-4 flex items-center gap-2 border-t pt-3">
          <NewIssueAttachButton onPick={attachments.attach} />
          <NewIssueAttachmentStrip
            items={attachments.pending}
            onInsert={bodySection === OTHER_SECTION ? undefined : insertIntoBody}
            onAnnotate={annotateAttachment}
            onRemove={removeAttachment}
          />
          <Button className="ml-auto" disabled={saving || !title.trim()} onClick={submit}>
            Create issue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
