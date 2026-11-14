import { Trash2 } from 'lucide-react';
import { formatDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import NeedsProLink from '@/components/common/NeedsProLink';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { ToolRowProps } from '../../types/toolSource';
import { ToolConfigDescription } from './ToolConfigDescription';

export function ToolConfigRow({
  tool,
  meta,
  integration,
  locked,
  canDelete,
  onOpen,
  onDelete,
}: ToolRowProps) {
  const t = useTranslations('teams.tools');
  const scopes = meta?.scopes ?? [];
  // The id tells a tool on an unlabelled credential from the same tool added with none.
  const credential =
    tool.credentialLabel ??
    (tool.credentialId != null ? t('credentialFallback', { id: tool.credentialId }) : null);
  const on = credential ? `${integration.label} · ${credential}` : integration.label;
  return (
    <TableRow className={cn('group/item', onOpen && 'cursor-pointer')} onClick={onOpen}>
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <IntegrationIcon integration={integration} />
          <div className="flex min-w-0 flex-col gap-0.5">
            {onOpen ? (
              <button
                type="button"
                className="truncate text-start text-sm font-medium text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              >
                {tool.label}
              </button>
            ) : (
              <span className="truncate text-sm font-medium text-foreground">{tool.label}</span>
            )}
            {tool.description && <ToolConfigDescription text={tool.description} />}
            <span className="truncate text-xs text-muted-foreground/70">{on}</span>
            {!tool.supported &&
              (locked ? (
                <NeedsProLink label={t('locked')} hint={t('lockedHint')} className="mt-1" />
              ) : (
                <span
                  title={t('unavailableHint')}
                  className="mt-1 text-xs font-medium text-warning"
                >
                  {t('unavailable')}
                </span>
              ))}
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
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={t('deleteLabel', { tool: tool.label })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
