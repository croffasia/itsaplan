'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import {
  disableDocumentShare,
  enableDocumentShare,
  type ShareOptions,
} from '@/lib/api/endpoints/share';
import { qk } from '@/services/queryKeys';
import { shareDocumentPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ShareDialog from '@/components/common/share/ShareDialog';

export default function DocumentShareButton({
  projectKey,
  document,
}: {
  projectKey: string;
  document: ProjectDocument;
}) {
  const t = useTranslations('documents');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const label = document.shareToken ? t('sharedPublicly') : t('sharePublicly');

  // Refetches the page so the share fields the dialog reads stay in sync.
  async function share(options: ShareOptions) {
    const state = await enableDocumentShare(document.id, options);
    await qc.invalidateQueries({ queryKey: qk.document(projectKey, document.id) });
    return state;
  }
  async function disable() {
    await disableDocumentShare(document.id);
    await qc.invalidateQueries({ queryKey: qk.document(projectKey, document.id) });
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={
              document.shareToken
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }
            onClick={() => setOpen(true)}
          >
            <Globe />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        title={t('sharePage')}
        token={document.shareToken}
        options={[
          { name: 'includeChildren', checked: document.shareIncludeChildren },
          { name: 'includeIssues', checked: document.shareIncludeIssues },
        ]}
        expiresAt={document.shareExpiresAt}
        enable={share}
        disable={disable}
        pathForToken={shareDocumentPath}
      />
    </>
  );
}
