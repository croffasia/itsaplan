'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  useLinkTemplatePublisher,
  useRequestPublisherCode,
} from '@/services/projectTemplates.service';
import { Button } from '@/components/ui/button';
import WorkspaceTemplateCodeInput, { CODE_LENGTH } from './WorkspaceTemplateCodeInput';

// Takes the code the gallery emailed and links the workspace with it. A full code is sent
// as soon as its last digit is typed.
export default function WorkspaceTemplatePublisherCode({
  workspaceId,
  email,
  onChangeEmail,
  onLinked,
  onCancel,
}: {
  workspaceId: number;
  email: string;
  onChangeEmail: () => void;
  onLinked: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('teams.templates.publish.link');
  const tCommon = useTranslations('common');
  const [code, setCode] = useState('');
  const requestCode = useRequestPublisherCode(workspaceId);
  const link = useLinkTemplatePublisher(workspaceId);

  function confirm(value: string) {
    link.mutate({ email, code: value }, { onSuccess: onLinked });
  }

  function changeCode(value: string) {
    setCode(value);
    link.reset();
    if (value.length === CODE_LENGTH) confirm(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t('codeSent', { email })}{' '}
        <Button variant="link" className="h-auto p-0" onClick={onChangeEmail}>
          {tCommon('change')}
        </Button>
      </p>
      <div className="flex flex-col gap-2">
        <WorkspaceTemplateCodeInput
          value={code}
          label={t('code')}
          invalid={link.isError}
          onChange={changeCode}
        />
        {link.error && <p className="text-sm text-destructive">{link.error.message}</p>}
      </div>
      <Button
        variant="link"
        className="h-auto self-start p-0 text-muted-foreground"
        disabled={requestCode.isPending}
        onClick={() => requestCode.mutate(email, { onSuccess: () => toast.success(t('resent')) })}
      >
        {t('resend')}
      </Button>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button
          disabled={code.length !== CODE_LENGTH || link.isPending}
          onClick={() => confirm(code)}
        >
          {t('confirm')}
        </Button>
      </div>
    </div>
  );
}
