'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TemplatePublisher } from '@/lib/api/endpoints/project-templates';
import { useSetPublisherAuthor } from '@/services/projectTemplates.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NAME_LIMIT = 80;
const URL_LIMIT = 200;

// The name and the profile link the gallery shows on every template of the address. The
// first time it is asked for, the account name stands in.
export default function WorkspaceTemplatePublisherAuthor({
  workspaceId,
  publisher,
  defaultName,
  onDone,
}: {
  workspaceId: number;
  publisher: TemplatePublisher;
  defaultName: string;
  onDone: () => void;
}) {
  const t = useTranslations('teams.templates.publish');
  const tCommon = useTranslations('common');
  const [authorName, setAuthorName] = useState(publisher.authorName || defaultName);
  const [authorUrl, setAuthorUrl] = useState(publisher.authorUrl ?? '');
  const setAuthor = useSetPublisherAuthor(workspaceId);

  const name = authorName.trim();
  const url = authorUrl.trim();
  const urlInvalid = url !== '' && (!url.startsWith('https://') || url.length > URL_LIMIT);
  const valid = name !== '' && name.length <= NAME_LIMIT && !urlInvalid;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('authorHint', { email: publisher.email })}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="publish-author">{t('authorName')}</Label>
        <Input
          id="publish-author"
          value={authorName}
          maxLength={NAME_LIMIT}
          autoFocus
          onChange={(e) => setAuthorName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="publish-author-url">{t('authorUrl')}</Label>
          <span className="text-xs text-muted-foreground">{t('optional')}</span>
        </div>
        <Input
          id="publish-author-url"
          type="url"
          dir="ltr"
          value={authorUrl}
          placeholder="https://"
          aria-invalid={urlInvalid}
          onChange={(e) => setAuthorUrl(e.target.value)}
        />
        {urlInvalid && <p className="text-xs text-destructive">{t('authorUrlInvalid')}</p>}
      </div>
      <div className="flex justify-end gap-2">
        {publisher.authorName && (
          <Button variant="ghost" onClick={onDone}>
            {tCommon('cancel')}
          </Button>
        )}
        <Button
          disabled={!valid || setAuthor.isPending}
          onClick={() =>
            setAuthor.mutate({ authorName: name, authorUrl: url || null }, { onSuccess: onDone })
          }
        >
          {tCommon('save')}
        </Button>
      </div>
    </div>
  );
}
