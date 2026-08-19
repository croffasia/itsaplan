import { useEffect, useRef, useState } from 'react';
import { KeyRound, TriangleAlert, X } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { useRegenerateAiAgentKey } from '@/services/aiAgents.service';
import { Button } from '@/components/ui/button';
import { useSettingsCan } from '../../context/settingsPermission';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { AgentFormSection } from './AgentFormSection';
import AgentKeyValue from './AgentKeyValue';
import { useTranslations } from 'next-intl';

// The API key of an external agent. The server keeps only a hash and the key's first
// characters, so the secret exists for the one moment it is issued: the section shows
// the key just issued by a create or a regenerate, and once that is dismissed only
// the stored prefix and the way to issue a new key.
export default function AgentTokenSection({
  projectKey,
  agent,
  revealedKey,
  onRevealedKey,
  ...section
}: {
  projectKey: string;
  // The saved agent, for its key prefix. Null while creating: no key exists yet.
  agent: AiAgent | null;
  // The plaintext key issued in this sheet, or null once dismissed.
  revealedKey: string | null;
  onRevealedKey: (apiKey: string | null) => void;
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.agents');
  const can = useSettingsCan();
  const regenerateKey = useRegenerateAiAgentKey(projectKey);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { onOpenChange } = section;

  // A key is worthless if it scrolls past unseen, so issuing one opens this section
  // and brings it into view. Tracked by value: onOpenChange is a new function every
  // render, so this effect reruns constantly and must not re-open a section the user
  // has since collapsed.
  const openedForKey = useRef<string | null>(null);
  useEffect(() => {
    if (revealedKey === null || openedForKey.current === revealedKey) return;
    openedForKey.current = revealedKey;
    onOpenChange(true);
    // The section is expanding in this frame; wait for it before measuring.
    requestAnimationFrame(() => wrapRef.current?.scrollIntoView({ block: 'center' }));
  }, [revealedKey, onOpenChange]);

  return (
    <div ref={wrapRef}>
      <AgentFormSection {...section} icon={KeyRound} title={t('apiKey')} hint={t('apiKeyHint')}>
        {revealedKey !== null ? (
          <div className="space-y-2.5 rounded-md bg-warning/5 p-3">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="min-w-0 flex-1 text-xs">{t('keyWarning')}</p>
              <button
                type="button"
                onClick={() => onRevealedKey(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={t('dismiss')}
                title={t('dismiss')}
              >
                <X className="size-4" />
              </button>
            </div>
            <AgentKeyValue apiKey={revealedKey} />
          </div>
        ) : agent === null ? (
          <p className="text-xs text-muted-foreground">{t('keyOnCreate')}</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-sm font-medium">{t('currentKey')}</span>
              <span className="block text-xs text-muted-foreground">{t('currentKeyHint')}</span>
            </div>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs">
                {agent.apiKeyStart ?? '—'}
                <span className="text-muted-foreground">••••••••</span>
              </code>
              {can('edit') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirming(true)}
                  disabled={regenerateKey.isPending}
                >
                  {t('regenerateConfirm')}
                </Button>
              )}
            </div>
          </div>
        )}
      </AgentFormSection>

      {confirming && agent && (
        <SettingsConfirmDeleteDialog
          title={t('regenerateTitle')}
          confirmLabel={t('regenerateConfirm')}
          message={t.rich('regenerateMessage', {
            name: agent.name,
            v: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const res = await regenerateKey.mutateAsync(agent.id);
            setConfirming(false);
            onRevealedKey(res.apiKey);
          }}
        />
      )}
    </div>
  );
}
