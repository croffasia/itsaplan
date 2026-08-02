import { type Editor } from '@tiptap/react';
import { type CustomField, type IssueFieldValueInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Embeddable } from '../../utils/attachmentEmbed';
import { DESCRIPTION_TAB, OTHER_TAB, fieldTab } from '../../utils/bodyTabs';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import NewIssueBodyFields from './NewIssueBodyFields';

// The written part of a new issue: the description, plus the custom fields the
// project shows in the body. Each markdown field gets its own tab so only one
// editor is on screen at a time — otherwise they stack up and the dialog turns
// into one long scroll. Every tab stays mounted (forceMount), so switching away
// keeps the editor instance the modal needs to strip an attachment's embeds.
export default function NewIssueBody({
  tab,
  onTabChange,
  fullscreen,
  description,
  onDescriptionChange,
  onDescriptionReady,
  bodyDefs,
  fieldValues,
  onFieldValue,
  onFieldEditorReady,
  uploadFile,
}: {
  // Held by the modal: it inserts an attachment into whichever editor is on
  // screen, so it has to know which tab that is.
  tab: string;
  onTabChange: (tab: string) => void;
  fullscreen: boolean;
  description: string;
  onDescriptionChange: (markdown: string) => void;
  onDescriptionReady: (editor: Editor | null) => void;
  bodyDefs: CustomField[];
  fieldValues: Record<number, IssueFieldValueInput>;
  onFieldValue: (id: number, patch: IssueFieldValueInput) => void;
  onFieldEditorReady: (id: number, editor: Editor | null) => void;
  uploadFile: (file: File) => Promise<Embeddable>;
}) {
  const markdownDefs = bodyDefs.filter((d) => d.fieldType === 'markdown');
  const pillDefs = bodyDefs.filter((d) => d.fieldType !== 'markdown');

  // In fullscreen the editor claims the leftover height; in compact it grows with
  // its content and scrolls once the dialog runs out of room.
  const editorClass = cn('overflow-y-auto', fullscreen ? 'min-h-48 flex-1' : 'min-h-24');

  const descriptionEditor = (
    <IssueMarkdownEditor
      className={cn(bodyDefs.length === 0 && 'mt-3', editorClass)}
      defaultValue={description}
      onChange={onDescriptionChange}
      onReady={onDescriptionReady}
      uploadFile={uploadFile}
    />
  );

  if (bodyDefs.length === 0) return descriptionEditor;

  // No flex-1 in compact: the tab is sized by its content there, but min-h-0
  // still lets it give height back once the dialog runs out of it.
  const contentClass = cn(
    'flex min-h-0 flex-col data-[state=inactive]:hidden',
    fullscreen && 'flex-1',
  );

  return (
    <Tabs
      value={tab}
      onValueChange={onTabChange}
      className={cn('mt-3 flex min-h-0 flex-col', fullscreen && 'flex-1')}
    >
      <TabsList variant="line" className="shrink-0">
        <TabsTrigger value={DESCRIPTION_TAB}>Description</TabsTrigger>
        {markdownDefs.map((def) => (
          <TabsTrigger key={def.id} value={fieldTab(def.id)}>
            {def.name}
          </TabsTrigger>
        ))}
        {pillDefs.length > 0 && <TabsTrigger value={OTHER_TAB}>Other</TabsTrigger>}
      </TabsList>

      <TabsContent value={DESCRIPTION_TAB} forceMount className={contentClass}>
        {descriptionEditor}
      </TabsContent>

      {markdownDefs.map((def) => (
        <TabsContent key={def.id} value={fieldTab(def.id)} forceMount className={contentClass}>
          <IssueMarkdownEditor
            className={editorClass}
            defaultValue={(fieldValues[def.id]?.value as string) ?? ''}
            placeholder="Empty"
            onChange={(md) => onFieldValue(def.id, { value: md })}
            onReady={(editor) => onFieldEditorReady(def.id, editor)}
            uploadFile={uploadFile}
          />
        </TabsContent>
      ))}

      {pillDefs.length > 0 && (
        <TabsContent value={OTHER_TAB} className={cn(contentClass, 'overflow-y-auto')}>
          <NewIssueBodyFields defs={pillDefs} values={fieldValues} onChange={onFieldValue} />
        </TabsContent>
      )}
    </Tabs>
  );
}
