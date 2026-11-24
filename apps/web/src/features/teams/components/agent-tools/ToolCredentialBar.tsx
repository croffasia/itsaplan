import { useId } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ToolIntegrationEntry } from '../../hooks/useAddTools';

const NONE = 'none';

// The credential the tools of one integration are added on: a select over the team's
// credentials of that integration with a way to add one, or a note when the integration
// takes none. Where the credential is optional, the select also offers none. Below it,
// the token permissions the selected tools need.
export function ToolCredentialBar({
  entry,
  onCredential,
  onAddCredential,
}: {
  entry: ToolIntegrationEntry;
  onCredential: (credentialId: number | null) => void;
  // Left out for a member who may not add a credential.
  onAddCredential?: () => void;
}) {
  const t = useTranslations('teams');
  const id = useId();
  const { integration, credentials, credentialId, pending, ready } = entry;
  const scopes = [...new Set(pending.flatMap((o) => o.scopes))];
  if (!ready) return null;

  return (
    <div className="space-y-1.5 px-4 py-3 sm:px-6">
      {!integration.takesCredential ? (
        <p className="text-xs text-muted-foreground">
          {t('tools.noCredentialNeeded', { integration: integration.label })}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor={id} className="shrink-0 text-xs">
            {t('tools.credential')}
          </Label>
          <Select
            value={credentialId != null ? String(credentialId) : NONE}
            onValueChange={(v) => onCredential(v === NONE ? null : Number(v))}
          >
            <SelectTrigger id={id} size="sm" className="w-full text-xs sm:w-56">
              <SelectValue placeholder={t('tools.chooseCredential')} />
            </SelectTrigger>
            <SelectContent>
              {!integration.needsCredential && (
                <SelectItem value={NONE}>{t('tools.keyless')}</SelectItem>
              )}
              {credentials.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {/* The id tells apart several unlabelled credentials of one integration. */}
                  {c.label ?? t('tools.credentialFallback', { id: c.id })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onAddCredential && (
            <Button
              variant="ghost"
              size="sm"
              className="ms-auto h-7 gap-1 px-2 text-xs"
              onClick={onAddCredential}
            >
              <Plus className="size-3" />
              {t('integrations.add')}
            </Button>
          )}
        </div>
      )}
      {scopes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="me-1 text-xs text-muted-foreground">{t('tools.scopesLabel')}</span>
          {scopes.map((s) => (
            <Badge key={s} variant="secondary" className="font-mono text-[10px] font-normal">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
