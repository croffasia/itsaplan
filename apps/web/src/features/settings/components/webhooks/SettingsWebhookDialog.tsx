import { useState } from 'react';
import { WEBHOOK_EVENT_TYPES, type Webhook, type WebhookEventType } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export interface WebhookFormValue {
  url: string;
  events: WebhookEventType[];
  isActive: boolean;
}

// Add/edit dialog for a webhook: the payload URL, the set of subscribed event
// types, and whether it is active. The secret is generated server-side and shown
// on the row, not here.
export function SettingsWebhookDialog({
  projectKey,
  initial,
  saving,
  onSave,
  onClose,
}: {
  projectKey: string;
  initial?: Webhook;
  saving: boolean;
  onSave: (value: WebhookFormValue) => Promise<void>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [events, setEvents] = useState<Set<WebhookEventType>>(new Set(initial?.events ?? []));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const valid = url.trim().length > 0 && events.size > 0;

  function toggleEvent(event: WebhookEventType, on: boolean) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (on) next.add(event);
      else next.delete(event);
      return next;
    });
  }

  async function submit() {
    if (!valid) return;
    await onSave({ url: url.trim(), events: [...events], isActive });
  }

  const actionLabel = initial ? 'Save webhook' : 'Create webhook';
  const pendingLabel = initial ? 'Saving…' : 'Creating…';

  return (
    <Modal
      title={initial ? 'Edit webhook' : 'New webhook'}
      description="Set the payload URL and choose which project events to send."
      projectKey={projectKey}
      onClose={onClose}
      wide
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="webhook-url">Payload URL</Label>
          <Input
            id="webhook-url"
            autoFocus
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Events</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENT_TYPES.map((event) => (
              <label key={event} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={events.has(event)}
                  onCheckedChange={(v) => toggleEvent(event, v === true)}
                />
                <span className="font-mono text-xs">{event}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-border/50 pt-4">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            <span>Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {saving ? pendingLabel : actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
