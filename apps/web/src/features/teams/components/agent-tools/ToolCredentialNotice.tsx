import { KeyRound, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// Shown above the tools of an integration the team holds no credential for: its tools
// are listed and cannot be selected until a credential is added. `onAdd` opens the
// credential form; it is left out for a member who may not add one.
export function ToolCredentialNotice({
  integration,
  onAdd,
}: {
  integration: string;
  onAdd?: () => void;
}) {
  const t = useTranslations('teams');
  return (
    <div className="mx-4 mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {t('tools.noCredential', { integration })}
        </p>
        <p className="text-xs text-muted-foreground">{t('tools.noCredentialHint')}</p>
      </div>
      {onAdd && (
        <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={onAdd}>
          <Plus className="size-3.5" />
          {t('integrations.add')}
        </Button>
      )}
    </div>
  );
}
