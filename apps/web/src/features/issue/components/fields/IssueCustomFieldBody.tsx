import { type CustomField, type IssueFieldValue, type IssueFieldValueInput } from '@/lib/api';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import IssueCustomFieldControl from './IssueCustomFieldControl';

// One custom field rendered in the issue body (under the description) rather than
// as a Properties row: a heading with the field name, then the value editor. A
// markdown field uses the full markdown editor; every other type reuses the
// inline control from the Properties grid.
export default function IssueCustomFieldBody({
  def,
  current,
  saveKey,
  uploadFile,
  onSetField,
}: {
  def: CustomField;
  current: IssueFieldValue | undefined;
  saveKey: string;
  uploadFile: (file: File) => Promise<{ url: string; contentType: string; filename: string }>;
  onSetField: (fieldId: number, value: IssueFieldValueInput) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {def.name}
      </h3>
      {def.fieldType === 'markdown' ? (
        <IssueMarkdownEditor
          defaultValue={(current?.value as string) ?? ''}
          key={saveKey}
          placeholder="Empty"
          uploadFile={uploadFile}
          onBlur={(md) => {
            const next = md.trim() === '' ? null : md;
            if (next !== ((current?.value as string | null) ?? null))
              onSetField(def.id, { value: next });
          }}
        />
      ) : (
        <IssueCustomFieldControl
          def={def}
          current={current}
          saveKey={saveKey}
          onChange={(value) => onSetField(def.id, value)}
        />
      )}
    </div>
  );
}
