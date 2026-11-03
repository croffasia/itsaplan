'use client';

import { useTranslations } from 'next-intl';
import { TEMPLATE_GALLERY_RULES_URL } from '@/utils/app';
import { useRequestPublisherCode } from '@/services/projectTemplates.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Asks the gallery to email a code to the address. Sending the code accepts the gallery
// rules.
export default function WorkspaceTemplatePublisherEmail({
  workspaceId,
  email,
  onEmailChange,
  onSent,
  onCancel,
}: {
  workspaceId: number;
  email: string;
  onEmailChange: (email: string) => void;
  onSent: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('teams.templates.publish.link');
  const tCommon = useTranslations('common');
  const requestCode = useRequestPublisherCode(workspaceId);
  const address = email.trim();
  const ready = EMAIL.test(address) && !requestCode.isPending;

  function send() {
    requestCode.mutate(address, {
      onSuccess: () => {
        onEmailChange(address);
        onSent();
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="publisher-email">{t('email')}</Label>
          <span className="text-xs text-muted-foreground">{t('emailHint')}</span>
        </div>
        <Input
          id="publisher-email"
          type="email"
          value={email}
          autoFocus
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ready && send()}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t.rich('agree', {
          rules: (chunks) => (
            <a
              href={TEMPLATE_GALLERY_RULES_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button disabled={!ready} onClick={send}>
          {t('sendCode')}
        </Button>
      </div>
    </div>
  );
}
