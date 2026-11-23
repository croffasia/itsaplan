'use client';

import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import type { ShareOptions, ShareState } from '@/lib/api/endpoints/share';
import { usePermissions } from '@/hooks/usePermissions';
import { copyText } from '@/utils/clipboard';
import { shareDocumentPath, shareUrl } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDocumentsQuery } from '../../services/documents.service';
import DocumentPublicLinkExpiry from './DocumentPublicLinkExpiry';
import DocumentShareToggle from './DocumentShareToggle';

// The live link and what it opens.
export default function DocumentPublicLinkSettings({
  projectKey,
  document,
  token,
  busy,
  onChange,
}: {
  projectKey: string;
  document: ProjectDocument;
  token: string;
  busy: boolean;
  onChange: (options: ShareOptions) => Promise<ShareState>;
}) {
  const t = useTranslations('documents');
  const tShare = useTranslations('common.share');
  // Linked work items open through the link, so the switch takes the right to share one.
  const canShareIssues = usePermissions().can('work_items', 'edit');
  const { data: documents } = useDocumentsQuery(projectKey);
  const hasSubpages = documents?.some((d) => d.parentId === document.id) ?? false;
  const url = shareUrl(shareDocumentPath(token));
  const set = (options: ShareOptions) => void onChange(options).catch(() => undefined);

  async function copy() {
    if (await copyText(url)) toast.success(t('publicLink.copied'));
    else toast.error(tShare('copyFailed'));
  }

  return (
    <>
      <div className="mt-2 flex gap-2">
        <Input
          readOnly
          value={url}
          dir="ltr"
          aria-label={t('publicLink.title')}
          onFocus={(e) => e.target.select()}
          className="h-8 flex-1 bg-muted text-[13px] text-muted-foreground shadow-none md:text-[13px]"
        />
        <Button
          type="button"
          size="sm"
          className="h-8 px-2.5 text-[13px]"
          onClick={() => void copy()}
        >
          {tShare('copy')}
        </Button>
      </div>
      <div className="mt-2 flex flex-col">
        <DocumentShareToggle
          label={tShare('includeSubpages')}
          hint={hasSubpages ? t('publicLink.subpagesHint') : t('publicLink.noSubpages')}
          checked={document.shareIncludeChildren}
          disabled={busy}
          onCheckedChange={(includeChildren) => set({ includeChildren })}
        />
        {canShareIssues && (
          <DocumentShareToggle
            label={t('publicLink.workItems')}
            hint={t('publicLink.workItemsHint')}
            checked={document.shareIncludeIssues}
            disabled={busy}
            onCheckedChange={(includeIssues) => set({ includeIssues })}
          />
        )}
        <DocumentPublicLinkExpiry
          expiresAt={document.shareExpiresAt}
          disabled={busy}
          onChange={(expiresAt) => onChange({ expiresAt })}
        />
      </div>
      <div className="-mx-2 mt-1.5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-[13px] text-muted-foreground"
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            {t('publicLink.open')}
          </a>
        </Button>
      </div>
    </>
  );
}
