import type { ActionDef, CustomField, ProjectDetail } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsActionRow } from './SettingsActionRow';

interface SettingsActionsTableProps {
  actions: ActionDef[];
  project: ProjectDetail;
  customFields: CustomField[];
  onEdit: (actionId: number) => void;
  onDuplicate: (action: ActionDef) => void;
  onDelete: (action: ActionDef) => void;
}

export function SettingsActionsTable({
  actions,
  project,
  customFields,
  onEdit,
  onDuplicate,
  onDelete,
}: SettingsActionsTableProps) {
  return (
    <Table className="min-w-[680px] table-fixed">
      <colgroup>
        <col className="w-[44%]" />
        <col className="w-[42%]" />
        <col className="w-[14%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">Action</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Then set</TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((action) => (
          <SettingsActionRow
            key={action.id}
            action={action}
            project={project}
            customFields={customFields}
            onEdit={() => onEdit(action.id)}
            onDuplicate={() => onDuplicate(action)}
            onDelete={() => onDelete(action)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
