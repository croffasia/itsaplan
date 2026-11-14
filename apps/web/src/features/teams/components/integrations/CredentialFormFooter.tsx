import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { CredentialFormState } from '../../hooks/useCredentialForm';

// The bottom row of the credential dialog: cancel and the main button, which validates the
// credential first and saves it once the check has passed.
export function CredentialFormFooter({
  form,
  onCancel,
}: {
  form: CredentialFormState;
  onCancel: () => void;
}) {
  const t = useTranslations('teams.integrations');
  const tCommon = useTranslations('common');
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onCancel} disabled={form.busy}>
        {tCommon('cancel')}
      </Button>
      {form.needsValidation ? (
        <Button onClick={() => void form.validate()} disabled={!form.canCheck}>
          {form.checking && <Loader2 className="animate-spin" />}
          {t('validate')}
        </Button>
      ) : (
        <Button onClick={() => void form.submit()} disabled={!form.canSubmit}>
          {form.isEdit ? tCommon('save') : t('add')}
        </Button>
      )}
    </div>
  );
}
