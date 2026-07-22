import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { IntegrationCredential } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCreateConfiguredTool } from '@/services/customTools.service';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import type { ToolOption } from './ToolConfigDialog';

// The masked secret fields of a credential joined into one line (e.g. "••••dmoT"), so
// several credentials of the same integration can be told apart.
const credMasked = (c: IntegrationCredential) =>
  Object.values(c.redacted)
    .map((v) => String(v))
    .filter(Boolean)
    .join(' · ');

// A credential's display text: its label if set, otherwise its masked secret, with the
// masked secret shown as a suffix when a label takes the primary slot.
function credLabel(c: IntegrationCredential): string {
  const masked = credMasked(c);
  const name = c.label ?? (masked || `Credential #${c.id}`);
  return c.label && masked ? `${name} · ${masked}` : name;
}

// Step two of adding a tool: pick the credential the tool runs on. The credential list
// is narrowed to the tool's integration; if none exists yet, the user is pointed at the
// Integrations page. `onBack` returns to the tool picker.
export function ToolCredentialStep({
  projectKey,
  tool,
  credentials,
  onBack,
  onDone,
}: {
  projectKey: string;
  tool: ToolOption;
  credentials: IntegrationCredential[];
  onBack: () => void;
  onDone: () => void;
}) {
  const matching = credentials.filter((c) => c.integrationKey === tool.integrationKey);
  const [credentialId, setCredentialId] = useState<number | null>(matching[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const create = useCreateConfiguredTool(projectKey);
  const canSubmit = credentialId != null && !busy;

  async function submit() {
    if (!canSubmit || credentialId == null) return;
    setBusy(true);
    try {
      await create.mutateAsync({ toolKey: tool.toolKey, credentialId });
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onBack}
          aria-label="Back to tools"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <IntegrationIcon
          integration={{ label: tool.integrationLabel, kind: 'tool' }}
          className="size-8"
        />
        <div className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{tool.label}</span>
          <span className="block text-xs text-muted-foreground">{tool.integrationLabel}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{tool.description}</p>

      {tool.scopes.length > 0 && (
        <div className="space-y-1.5">
          <Label>Required token permissions</Label>
          <div className="flex flex-wrap gap-1">
            {tool.scopes.map((s) => (
              <Badge key={s} variant="secondary" className="font-mono text-[10px] font-normal">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Credential</Label>
        {matching.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No {tool.integrationLabel} credential yet. Add one on the Integrations page first.
          </p>
        ) : (
          <Select
            value={credentialId != null ? String(credentialId) : ''}
            onValueChange={(v) => setCredentialId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a credential" />
            </SelectTrigger>
            <SelectContent>
              {matching.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {credLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          Add tool
        </Button>
      </div>
    </div>
  );
}
