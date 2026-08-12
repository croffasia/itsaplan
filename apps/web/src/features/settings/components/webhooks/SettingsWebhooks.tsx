import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail, Webhook } from '@/lib/api';
import {
  useWebhooksQuery,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
} from '@/services/webhooks.service';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsWebhookDialog, type WebhookFormValue } from './SettingsWebhookDialog';
import { SettingsWebhooksTable } from './SettingsWebhooksTable';
import { SettingsWebhookDeliveriesSheet } from './SettingsWebhookDeliveriesSheet';

// Project settings tab for outgoing webhooks. Each webhook posts subscribed
// project events to its URL, signed with a per-webhook secret. Delivery is handled
// by the server; this tab manages the subscriptions.
export default function SettingsWebhooks({
  project,
  requestNew,
  onNewHandled,
}: {
  project: ProjectDetail;
  requestNew: boolean;
  onNewHandled: () => void;
}) {
  const t = useTranslations('settings.webhooks');
  const projectKey = project.project.key;
  const webhooksQuery = useWebhooksQuery(projectKey);
  const webhooks = webhooksQuery.data ?? [];
  const createWebhook = useCreateWebhook(projectKey);
  const updateWebhook = useUpdateWebhook(projectKey);
  const deleteWebhook = useDeleteWebhook(projectKey);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Webhook | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<Webhook | null>(null);

  // The "New webhook" button lives in the page header; opening is signalled here.
  useEffect(() => {
    if (!requestNew) return;
    setEditing('new');
    onNewHandled();
  }, [requestNew, onNewHandled]);

  const saving = createWebhook.isPending || updateWebhook.isPending;
  const editingWebhook =
    typeof editing === 'number' ? webhooks.find((w) => w.id === editing) : undefined;
  const showDialog = editing === 'new' || editingWebhook != null;

  async function saveWebhook(value: WebhookFormValue) {
    if (editing === 'new') {
      await createWebhook.mutateAsync({ input: value });
    } else if (typeof editing === 'number') {
      await updateWebhook.mutateAsync({ id: editing, input: value });
    }
    setEditing(null);
  }

  return (
    <>
      {webhooksQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : webhooks.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <SettingsWebhooksTable
            webhooks={webhooks}
            onShowDeliveries={setDeliveriesFor}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        </div>
      )}

      {showDialog && (
        <SettingsWebhookDialog
          key={editingWebhook?.id ?? 'new'}
          projectKey={projectKey}
          initial={editingWebhook}
          saving={saving}
          onSave={saveWebhook}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('deleteTitle')}
          confirmLabel={t('delete')}
          message={t.rich('deleteMessage', {
            url: deleting.url,
            v: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteWebhook.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}

      <SettingsWebhookDeliveriesSheet
        webhook={deliveriesFor}
        onClose={() => setDeliveriesFor(null)}
      />
    </>
  );
}
