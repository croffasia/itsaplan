import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Webhook, WebhookDelivery } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { useWebhookDeliveries } from '@/services/webhooks.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { JsonViewer } from './JsonViewer';

// Delivery history for a webhook, in a right-side sidebar. Paged through
// useWebhookDeliveries, which owns the page size; each delivery expands to show the
// payload we sent and the response we got back.
export function SettingsWebhookDeliveriesSheet({
  webhook,
  onClose,
}: {
  webhook: Webhook | null;
  onClose: () => void;
}) {
  const t = useTranslations('settings.webhooks');

  return (
    <Sheet open={webhook != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('deliveryHistory')}</SheetTitle>
          <SheetDescription className="truncate font-mono text-xs">{webhook?.url}</SheetDescription>
        </SheetHeader>
        {webhook && <DeliveriesList webhookId={webhook.id} />}
      </SheetContent>
    </Sheet>
  );
}

function DeliveriesList({ webhookId }: { webhookId: number }) {
  const t = useTranslations('settings.webhooks');
  const tCommon = useTranslations('common');
  const query = useWebhookDeliveries(webhookId);
  const deliveries = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) {
    return <ListSkeleton rows={4} className="p-4" rowClassName="h-12" />;
  }
  if (deliveries.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('noDeliveries')}</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="divide-y divide-border/50">
        {deliveries.map((d) => (
          <DeliveryItem key={d.id} delivery={d} />
        ))}
      </div>
      <div className="p-4">
        {query.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? tCommon('loading') : t('loadMore')}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">{t('endOfHistory')}</p>
        )}
      </div>
    </div>
  );
}

function DeliveryItem({ delivery: d }: { delivery: WebhookDelivery }) {
  const t = useTranslations('settings.webhooks');
  const [open, setOpen] = useState(false);
  // What came back: the response status, the error, or that it is still queued.
  const outcome =
    d.responseStatus != null
      ? `HTTP ${d.responseStatus}`
      : (d.lastError ?? (d.status === 'pending' ? t('queued') : ''));
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs hover:bg-accent/50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        <StatusBadge status={d.status} />
        <span className="font-mono">{d.eventType}</span>
        {d.attempts > 1 && (
          <span className="text-muted-foreground">{t('attempts', { count: d.attempts })}</span>
        )}
        <span className="truncate text-muted-foreground">{outcome}</span>
        <span className="ml-auto shrink-0 text-muted-foreground">
          {formatDateTime(d.createdAt)}
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-3">
          <DetailBlock label={t('sent')} value={d.payload} />
          <DetailBlock
            label={
              d.responseStatus != null
                ? t('responseWithStatus', { status: d.responseStatus })
                : t('response')
            }
            value={d.responseBody ?? d.lastError}
          />
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: unknown }) {
  const t = useTranslations('settings.webhooks');
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {value == null || value === '' ? (
        <p className="text-xs text-muted-foreground">{t('noResponse')}</p>
      ) : (
        <JsonViewer value={value} />
      )}
    </div>
  );
}

const STATUS_VARIANT: Record<WebhookDelivery['status'], 'secondary' | 'destructive' | 'outline'> = {
  success: 'secondary',
  failed: 'destructive',
  pending: 'outline',
};

function StatusBadge({ status }: { status: WebhookDelivery['status'] }) {
  const t = useTranslations('settings.webhooks');
  return (
    <Badge variant={STATUS_VARIANT[status]} className="shrink-0">
      {t(`statuses.${status}`)}
    </Badge>
  );
}
