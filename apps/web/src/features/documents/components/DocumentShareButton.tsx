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
import { usePermissions } from '@/hooks/usePermissions';
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
  // Linked issues open through the link, so the switch takes the right to share an issue.
  const canShareIssues = usePermissions().can('work_items', 'edit');
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
                ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'
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
          ...(canShareIssues
            ? [{ name: 'includeIssues' as const, checked: document.shareIncludeIssues }]
            : []),
        ]}
        expiresAt={document.shareExpiresAt}
        enable={share}
        disable={disable}
        pathForToken={shareDocumentPath}
      />
    </>
  );
}
