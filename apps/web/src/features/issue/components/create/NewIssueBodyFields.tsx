import { type Assignee, type CustomField, type IssueFieldValueInput } from '@/lib/api';
import IssueCustomFieldPill from '../fields/IssueCustomFieldPill';

// The body fields that are not markdown, gathered in the "Other" section: a pill
// each is too small to be worth a section of its own.
export default function NewIssueBodyFields({
  defs,
  values,
  assignees,
  onChange,
}: {
  defs: CustomField[];
  values: Record<number, IssueFieldValueInput>;
  assignees: Assignee[];
  onChange: (id: number, patch: IssueFieldValueInput) => void;
}) {
  return (
    <div className="space-y-4">
      {defs.map((def) => (
        <div key={def.id}>
          <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {def.name}
          </h3>
          <IssueCustomFieldPill
            def={def}
            value={values[def.id]}
            assignees={assignees}
            onChange={(v) => onChange(def.id, v)}
          />
        </div>
      ))}
    </div>
  );
}
