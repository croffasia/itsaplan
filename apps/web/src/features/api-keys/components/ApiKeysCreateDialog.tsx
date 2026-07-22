'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { apiKey } from '@/lib/auth-client';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// The created key value is kept in this dialog only, never lifted into page state:
// it is shown once, right after creation, and cannot be retrieved later.
export default function ApiKeysCreateDialog({
  onCreated,
  onClose,
}: {
  onCreated: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    // Own the error UI inline, so opt out of the global error toast.
    meta: { suppressErrorToast: true },
    mutationFn: async () => {
      const { data, error } = await apiKey.create({ name: name.trim() });
      if (error) throw new Error(error.message ?? 'Could not create API key.');
      return data;
    },
    onSuccess: (data) => {
      setCreatedKey(data?.key ?? '');
      onCreated();
    },
  });

  async function copy() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  if (createdKey !== null) {
    return (
      <Modal title="API key created" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy your key now. For security, it is shown only once and cannot be retrieved later.
          </p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={createdKey}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Copy key"
              onClick={copy}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const trimmed = name.trim();

  return (
    <Modal title="Create API key" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) createMutation.mutate();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="api-key-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="api-key-name"
            autoFocus
            placeholder="e.g. CI pipeline"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">A label to recognize this key later.</p>
        </div>

        {createMutation.error && (
          <p className="text-sm text-destructive">{createMutation.error.message}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed || createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create key'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
