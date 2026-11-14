import { Trash2 } from 'lucide-react';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { formatDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { useTranslations } from 'next-intl';
import { ToolConfigDescription } from './ToolConfigDescription';

export function ToolConfigRow({
  tool,
  meta,
  integration,
  canDelete,
  onDelete,
}: {
  tool: ConfiguredTool;
  // Absent when the catalog no longer has the tool; the row then shows its key.
  meta: IntegrationMeta['tools'][number] | undefined;
  integration: Pick<IntegrationMeta, 'label' | 'kind' | 'icon'>;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations('teams.tools');
  const scopes = meta?.scopes ?? [];
  // The id tells a tool on an unlabelled credential from the same tool added with none.
  const credential =
    tool.credentialLabel ??
    (tool.credentialId != null ? t('credentialFallback', { id: tool.credentialId }) : null);
  const on = credential ? `${integration.label} · ${credential}` : integration.label;
  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <IntegrationIcon integration={integration} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {meta?.label ?? tool.toolKey}
            </span>
            {meta?.description && <ToolConfigDescription text={meta.description} />}
            <span className="truncate text-xs text-muted-foreground/70">{on}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        {scopes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {scopes.map((s) => (
              <Badge key={s} variant="secondary" className="font-mono text-[10px] font-normal">
                {s}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs leading-5 text-muted-foreground">{t('noScopes')}</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-3 align-top text-sm text-muted-foreground">
        {formatDate(tool.createdAt)}
      </TableCell>
      <TableCell className="px-3 py-2 align-top">
        <div className="flex items-center justify-end gap-1">
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label={t('deleteLabel', { tool: meta?.label ?? tool.toolKey })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
