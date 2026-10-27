import { useState, type ReactNode } from 'react';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueFieldValueEntry, IssueFieldValueInput } from '@/lib/api/endpoints/issues';
import type { Assignee } from '@/lib/api/endpoints/projects';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import IssueCustomFieldControl from '@/features/issue/components/fields/IssueCustomFieldControl';

// The editor of a custom field that the issue panel edits in place (a url, a
// number, a text), opened from a cell. It closes once a value is saved.
export function CustomFieldPopover({
  trigger,
  field,
  entry,
  assignees,
  saveKey,
  onChange,
}: {
  trigger: ReactNode;
  field: CustomField;
  entry: IssueFieldValueEntry | undefined;
  assignees: Assignee[];
  saveKey: string;
  onChange: (value: IssueFieldValueInput) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <IssueCustomFieldControl
          def={field}
          current={entry}
          assignees={assignees}
          saveKey={saveKey}
          onChange={(value) => {
            onChange(value);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
