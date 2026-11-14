import { Pencil, Trash2 } from 'lucide-react';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// One credential as a table row. A click on the row opens the editor.
export function CredentialRow({
  credential,
  integration,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  credential: IntegrationCredential;
  integration: Pick<IntegrationMeta, 'label' | 'kind' | 'icon'> &
    Partial<Pick<IntegrationMeta, 'credentialSchema'>>;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('teams.integrations');
  const fields = Object.entries(credential.redacted);
  // The form's name for a field; a field the catalog no longer lists keeps its key.
  const fieldLabel = (key: string) =>
    integration.credentialSchema?.find((f) => f.key === key)?.label ?? key;
  return (
    <TableRow
      className={cn('group/item', canEdit && 'cursor-pointer')}
      onClick={canEdit ? onEdit : undefined}
    >
      <TableCell className="px-3 py-3 whitespace-normal">
        <div className="flex min-w-0 items-center gap-2.5">
          <IntegrationIcon integration={integration} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {integration.label}
            </span>
            {credential.label && (
              <span className="truncate text-xs text-muted-foreground">{credential.label}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 whitespace-normal">
        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {fields.map(([k, v]) => (
              <Badge key={k} variant="outline" className="font-mono text-[10px] font-normal">
                {fieldLabel(k)}: {String(v)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('noFields')}</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              aria-label={t('editLabel', { integration: integration.label })}
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
              aria-label={t('deleteLabel', { integration: integration.label })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
