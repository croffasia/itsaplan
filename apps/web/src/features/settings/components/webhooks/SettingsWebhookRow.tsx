import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, History, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Webhook } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SettingsIconButton from '../SettingsIconButton';
import { useSettingsCan } from '../../context/settingsPermission';

export function SettingsWebhookRow({
  webhook,
  onShowDeliveries,
  onEdit,
  onDelete,
}: {
  webhook: Webhook;
  onShowDeliveries: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const can = useSettingsCan();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(webhook.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / denied); leave the secret visible to copy manually.
    }
  }

  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
              webhook.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
            title={webhook.isActive ? 'Active' : 'Disabled'}
          />
          <div className="min-w-0 space-y-1.5">
            <span className="block truncate text-sm font-medium" title={webhook.url}>
              {webhook.url}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-mono">
                {revealed ? webhook.secret : maskSecret(webhook.secret)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                title={revealed ? 'Hide secret' : 'Reveal secret'}
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                title="Copy secret"
                onClick={copySecret}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        <div className="flex flex-wrap gap-1">
          {webhook.events.map((event) => (
            <Badge key={event} variant="outline" className="font-mono text-[10px]">
              {event}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          <SettingsIconButton title="Delivery history" onClick={onShowDeliveries}>
            <History className="size-4" />
          </SettingsIconButton>
          {(can('edit') || can('delete')) && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground hover:text-foreground sm:size-8"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {can('edit') && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onEdit}>
                    <Pencil />
                    Edit webhook
                  </DropdownMenuItem>
                )}
                {can('delete') && can('edit') && <DropdownMenuSeparator />}
                {can('delete') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    variant="destructive"
                    onSelect={onDelete}
                  >
                    <Trash2 />
                    Delete webhook
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// Keeps only the leading characters visible; the rest of the secret is replaced by
// a fixed number of dots so its real length is not exposed.
function maskSecret(secret: string): string {
  return `${secret.slice(0, 11)}${'•'.repeat(8)}`;
}
