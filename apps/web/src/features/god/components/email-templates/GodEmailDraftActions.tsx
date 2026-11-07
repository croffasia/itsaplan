'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTestEmailDraft } from '../../services/god.service';
import type { EmailSelection, GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailDraftActions({
  form,
  selection,
  canReset,
  onReset,
}: {
  form: GodEmailTemplatesForm;
  selection: EmailSelection;
  canReset: boolean;
  onReset: () => void;
}) {
  const t = useTranslations('god.emailTemplates');
  const test = useTestEmailDraft();
  const draft = form.draft(selection.key, selection.locale);

  async function send() {
    try {
      const { recipient } = await test.mutateAsync(draft);
      toast.success(t('testSent', { email: recipient }));
    } catch {
      // The global mutation handler shows the API error.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <Button type="button" variant="ghost" size="sm" disabled={!canReset} onClick={onReset}>
        <RotateCcw className="size-4" />
        {t('reset')}
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        {!form.settings.canSend && (
          <span className="text-xs text-muted-foreground">{t('testNeedsProvider')}</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!form.settings.canSend || !draft.text.subject.trim() || test.isPending}
          onClick={() => void send()}
        >
          <Send className="size-4" />
          {test.isPending ? t('testing') : t('test')}
        </Button>
      </div>
    </div>
  );
}
