import { type Editor } from '@tiptap/react';
import { type Assignee, type CustomField, type IssueFieldValueInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type Embeddable } from '../../utils/attachmentEmbed';
import { DESCRIPTION_SECTION, OTHER_SECTION, fieldSection } from '../../utils/bodySections';
import { hasFieldValue } from '../../utils/fieldValues';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import NewIssueBodyFields from './NewIssueBodyFields';
import NewIssueBodySwitcher from './NewIssueBodySwitcher';
import { useTranslations } from 'next-intl';

// The written part of a new issue: the description, plus the custom fields the
// project shows in the body. A switcher keeps one markdown field on screen at a
// time — otherwise the editors stack up and the dialog turns into one long
// scroll. The hidden sections stay mounted, so switching away keeps the editor
// instance the modal needs to strip an attachment's embeds.
export default function NewIssueBody({
  section,
  onSectionChange,
  fullscreen,
  description,
  onDescriptionChange,
  onDescriptionReady,
  bodyDefs,
  fieldValues,
  assignees,
  onFieldValue,
  onFieldEditorReady,
  uploadFile,
}: {
  // Held by the modal: it inserts an attachment into whichever editor is on
  // screen, so it has to know which section that is.
  section: string;
  onSectionChange: (section: string) => void;
  fullscreen: boolean;
  description: string;
  onDescriptionChange: (markdown: string) => void;
  onDescriptionReady: (editor: Editor | null) => void;
  bodyDefs: CustomField[];
  fieldValues: Record<number, IssueFieldValueInput>;
  assignees: Assignee[];
  onFieldValue: (id: number, patch: IssueFieldValueInput) => void;
  onFieldEditorReady: (id: number, editor: Editor | null) => void;
  uploadFile: (file: File) => Promise<Embeddable>;
}) {
  const t = useTranslations('issue.create');
  const tEditor = useTranslations('issue.editor');
  const tFields = useTranslations('issue.fields');
  const markdownDefs = bodyDefs.filter((d) => d.fieldType === 'markdown');
  const pillDefs = bodyDefs.filter((d) => d.fieldType !== 'markdown');

  // In fullscreen the editor claims the leftover height; in compact it grows with
  // its content and scrolls once the dialog runs out of room.
  const editorClass = cn('overflow-y-auto', fullscreen ? 'min-h-48 flex-1' : 'min-h-24');

  const descriptionEditor = (
    <IssueMarkdownEditor
      className={cn(bodyDefs.length === 0 && 'mt-3', editorClass)}
      placeholder={tEditor('descriptionPlaceholder')}
      defaultValue={description}
      onChange={onDescriptionChange}
      onReady={onDescriptionReady}
      uploadFile={uploadFile}
    />
  );

  if (bodyDefs.length === 0) return descriptionEditor;

  const sections = [
    { value: DESCRIPTION_SECTION, label: t('description'), filled: description.trim() !== '' },
    ...markdownDefs.map((def) => ({
      value: fieldSection(def.id),
      label: def.name,
      filled: hasFieldValue(fieldValues[def.id]),
    })),
    ...(pillDefs.length > 0
      ? [
          {
            value: OTHER_SECTION,
            label: t('other'),
            filled: pillDefs.some((def) => hasFieldValue(fieldValues[def.id])),
          },
        ]
      : []),
  ];

  // Changing the issue type swaps the body fields, which can leave the selected
  // section pointing at one that is gone.
  const active = sections.some((s) => s.value === section) ? section : DESCRIPTION_SECTION;

  // No flex-1 in compact: the section is sized by its content there, but min-h-0
  // still lets it give height back once the dialog runs out of it.
  const sectionClass = (value: string) =>
    cn('flex min-h-0 flex-col', fullscreen && 'flex-1', value !== active && 'hidden');

  return (
    <div className={cn('mt-3 flex min-h-0 flex-col gap-1.5', fullscreen && 'flex-1')}>
      <div className="flex shrink-0 items-center">
        <NewIssueBodySwitcher sections={sections} value={active} onChange={onSectionChange} />
      </div>

      <div className={sectionClass(DESCRIPTION_SECTION)}>{descriptionEditor}</div>

      {markdownDefs.map((def) => (
        <div key={def.id} className={sectionClass(fieldSection(def.id))}>
          <IssueMarkdownEditor
            className={editorClass}
            defaultValue={(fieldValues[def.id]?.value as string) ?? ''}
            placeholder={tFields('empty')}
            onChange={(md) => onFieldValue(def.id, { value: md })}
            onReady={(editor) => onFieldEditorReady(def.id, editor)}
            uploadFile={uploadFile}
          />
        </div>
      ))}

      {pillDefs.length > 0 && (
        <div className={cn(sectionClass(OTHER_SECTION), 'overflow-y-auto')}>
          <NewIssueBodyFields
            defs={pillDefs}
            values={fieldValues}
            assignees={assignees}
            onChange={onFieldValue}
          />
        </div>
      )}
    </div>
  );
}
