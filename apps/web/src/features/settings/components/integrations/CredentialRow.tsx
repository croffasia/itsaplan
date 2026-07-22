import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import type { IntegrationCredential } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

// One credential as a table row: the integration name and optional account label,
// the redacted fields as badges, and edit/delete actions gated by permission.
export function CredentialRow({
  credential,
  integrationLabel,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  credential: IntegrationCredential;
  integrationLabel: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fields = Object.entries(credential.redacted);
  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <span className="truncate text-sm font-medium text-foreground">{integrationLabel}</span>
            {credential.label && (
              <span className="truncate text-xs text-muted-foreground">{credential.label}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 pt-4 align-top whitespace-normal">
        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {fields.map(([k, v]) => (
              <Badge key={k} variant="outline" className="font-mono text-[10px] font-normal">
                {k}: {String(v)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No fields</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 pt-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              aria-label="Edit credential"
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete credential"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
