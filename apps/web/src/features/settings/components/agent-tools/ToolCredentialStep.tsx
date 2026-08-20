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
import { useConfiguredToolsQuery, useCreateConfiguredTool } from '@/services/customTools.service';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import type { ToolOption } from './ToolConfigDialog';
import { useTranslations } from 'next-intl';

// The id is the fallback so several unlabelled credentials of the same integration
// can still be told apart.
const credLabel = (c: IntegrationOption) => c.label ?? `Credential #${c.id}`;

// Step two of adding tools: pick the credential they run on. All picked tools belong to
// one integration, so one credential covers them; the list is narrowed to that
// integration, and if none exists yet, the user is pointed at the Integrations page.
// Tools already configured on the chosen credential are skipped, because the API answers
// 409 for a duplicate and that would abort the rest of the batch. `onBack` returns to the
// tool picker.
export function ToolCredentialStep({
  projectKey,
  tools,
  credentials,
  onBack,
  onDone,
}: {
  projectKey: string;
  tools: ToolOption[];
  credentials: IntegrationOption[];
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('settings.tools');
  const tCommon = useTranslations('common');
  const { integrationKey, integrationLabel } = tools[0];
  const matching = credentials.filter((c) => c.integrationKey === integrationKey);
  const [credentialId, setCredentialId] = useState<number | null>(matching[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const configured = useConfiguredToolsQuery(projectKey).data ?? [];
  const pending = tools.filter(
    (tool) =>
      !configured.some((c) => c.toolKey === tool.toolKey && c.credentialId === credentialId),
  );
  const skipped = tools.length - pending.length;
  const scopes = [...new Set(tools.flatMap((tool) => tool.scopes))];

  const create = useCreateConfiguredTool(projectKey);
  const canSubmit = credentialId != null && pending.length > 0 && !busy;

  async function submit() {
    if (!canSubmit || credentialId == null) return;
    setBusy(true);
    try {
      for (const tool of pending) {
        await create.mutateAsync({ toolKey: tool.toolKey, credentialId });
      }
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
          integration={{ label: integrationLabel, kind: 'tool' }}
          className="size-8"
        />
        <div className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{integrationLabel}</span>
          <span className="block text-xs text-muted-foreground">
            {t('selectedCount', { count: tools.length })}
          </span>
        </div>
      </div>

      <div className="max-h-40 space-y-2 overflow-y-auto">
        {tools.map((tool) => (
          <div key={tool.toolKey}>
            <span className="block text-sm text-foreground">{tool.label}</span>
            <span className="block text-xs text-muted-foreground">{tool.description}</span>
          </div>
        ))}
      </div>

      {scopes.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t('scopesLabel')}</Label>
          <div className="flex flex-wrap gap-1">
            {scopes.map((s) => (
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
            {t('noCredential', { integration: integrationLabel })}
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
        {skipped > 0 && (
          <p className="text-xs text-muted-foreground">{t('alreadyAdded', { count: skipped })}</p>
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
