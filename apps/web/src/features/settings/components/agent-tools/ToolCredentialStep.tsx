import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { IntegrationOption } from '@/lib/api';
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
import { useTranslations } from 'next-intl';

// The id is the fallback so several unlabelled credentials of the same integration
// can still be told apart.
const credLabel = (c: IntegrationOption) => c.label ?? `Credential #${c.id}`;

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
  credentials: IntegrationOption[];
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('settings.tools');
  const tCommon = useTranslations('common');
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
          aria-label={t('back')}
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
          <Label>{t('scopesLabel')}</Label>
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
        <Label>{t('credential')}</Label>
        {matching.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('noCredential', { integration: tool.integrationLabel })}
          </p>
        ) : (
          <Select
            value={credentialId != null ? String(credentialId) : ''}
            onValueChange={(v) => setCredentialId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('chooseCredential')} />
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
          {tCommon('cancel')}
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {t('add')}
        </Button>
      </div>
    </div>
  );
}
