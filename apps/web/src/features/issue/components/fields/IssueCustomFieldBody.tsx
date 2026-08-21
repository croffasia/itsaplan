import {
  type Assignee,
  type CustomField,
  type IssueFieldValue,
  type IssueFieldValueInput,
} from '@/lib/api';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import { type Embeddable } from '../../utils/attachmentEmbed';
import IssueCustomFieldControl from './IssueCustomFieldControl';
import { useTranslations } from 'next-intl';

// One custom field rendered in the issue body (under the description) rather than
// as a Properties row: a heading with the field name, then the value editor. A
// markdown field uses the full markdown editor; every other type reuses the
// inline control from the Properties grid.
export default function IssueCustomFieldBody({
  def,
  current,
  assignees,
  saveKey,
  uploadFile,
  imageAttachments,
  onSetField,
  readOnly,
}: {
  def: CustomField;
  current: IssueFieldValue | undefined;
  assignees: Assignee[];
  saveKey: string;
  uploadFile?: (file: File) => Promise<Embeddable>;
  imageAttachments?: Embeddable[];
  onSetField: (fieldId: number, value: IssueFieldValueInput) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fields');
  return (
    <div className="mt-6">
      <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {def.name}
      </h3>
      {def.fieldType === 'markdown' ? (
        <IssueMarkdownEditor
          defaultValue={(current?.value as string) ?? ''}
          key={saveKey}
          placeholder={t('empty')}
          editable={!readOnly}
          uploadFile={uploadFile}
          imageAttachments={imageAttachments}
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
          assignees={assignees}
          saveKey={saveKey}
          onChange={(value) => onSetField(def.id, value)}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
