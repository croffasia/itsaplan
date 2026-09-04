import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { GodEmailForm } from '../../hooks/useGodEmailForm';

export default function GodEmailTestButton({ form }: { form: GodEmailForm }) {
  const t = useTranslations('god.email');

  async function send() {
    try {
      const recipient = await form.test();
      toast.success(t('testSent', { email: recipient }));
    } catch {
      // The global mutation handler shows the API error.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        {form.testable ? t('testHint') : t('testConfigureFirst')}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={send}
        disabled={!form.testable || form.saving || form.testing}
      >
        {form.testing ? t('testing') : t('test')}
      </Button>
    </div>
  );
}
