import { Trash2 } from 'lucide-react';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useTranslations } from 'next-intl';

export function ToolConfigRow({
  tool,
  meta,
  integrationLabel,
  canDelete,
  onDelete,
}: {
  tool: ConfiguredTool;
  // Absent when the catalog no longer has the tool; the row then shows its key.
  meta: IntegrationMeta['tools'][number] | undefined;
  integrationLabel: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations('teams.tools');
  const scopes = meta?.scopes ?? [];
  const on = tool.credentialLabel
    ? `${integrationLabel} · ${tool.credentialLabel}`
    : integrationLabel;
  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {meta?.label ?? tool.toolKey}
          </span>
          {meta?.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground" title={meta.description}>
              {meta.description}
            </p>
          )}
          <span className="truncate text-xs text-muted-foreground/70">{on}</span>
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
      <TableCell className="px-3 py-2 align-top">
        <div className="flex items-center justify-end gap-1">
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label={t('delete')}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
