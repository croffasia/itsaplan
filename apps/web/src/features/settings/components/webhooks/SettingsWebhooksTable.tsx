import type { Webhook } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsWebhookRow } from './SettingsWebhookRow';

interface SettingsWebhooksTableProps {
  webhooks: Webhook[];
  onShowDeliveries: (webhook: Webhook) => void;
  onEdit: (webhookId: number) => void;
  onDelete: (webhook: Webhook) => void;
}

export function SettingsWebhooksTable({
  webhooks,
  onShowDeliveries,
  onEdit,
  onDelete,
}: SettingsWebhooksTableProps) {
  return (
    <Table className="min-w-[820px] table-fixed">
      <colgroup>
        <col className="w-[40%]" />
        <col className="w-[46%]" />
        <col className="w-[14%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">Endpoint</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Events</TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {webhooks.map((webhook) => (
          <SettingsWebhookRow
            key={webhook.id}
            webhook={webhook}
            onShowDeliveries={() => onShowDeliveries(webhook)}
            onEdit={() => onEdit(webhook.id)}
            onDelete={() => onDelete(webhook)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
