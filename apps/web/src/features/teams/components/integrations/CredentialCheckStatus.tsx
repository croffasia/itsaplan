import { CircleX, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CredentialCheck } from '@/lib/api/endpoints/integrations';
import { Alert, AlertDescription } from '@/components/ui/alert';

// What the service said about the credential, under the field the check is about. A
// valid one is shown as a check mark in the field, so here it is told to screen readers.
export function CredentialCheckStatus({
  check,
  integration,
}: {
  check: CredentialCheck | null;
  integration: string;
}) {
  const t = useTranslations('teams.integrations');
  return (
    <div role="status" className="pt-1 empty:hidden">
      {check === 'valid' && <span className="sr-only">{t('checkValid', { integration })}</span>}
      {(check === 'rejected' || check === 'unavailable') && (
        <Alert variant="destructive">
          <CircleX />
          <AlertDescription>
            {check === 'rejected'
              ? t('checkRejected', { integration })
              : t('checkUnavailable', { integration })}
          </AlertDescription>
        </Alert>
      )}
      {check === 'unknown' && (
        <Alert className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <Info />
          <AlertDescription className="text-current">{t('checkUnknown')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
