'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  DocumentVisibility,
  ProjectDocument,
  ProjectDocumentSummary,
} from '@/lib/api/endpoints/documents';
import { copyText } from '@/utils/clipboard';
import { documentPath, shareUrl } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import DocumentAccessOptions from './DocumentAccessOptions';
import DocumentAccessReadOnly from './DocumentAccessReadOnly';
import DocumentAccessSection from './DocumentAccessSection';
import DocumentPublicLink from './DocumentPublicLink';

export default function DocumentAccessPanel({
  projectKey,
  document,
  ancestors,
  canChange,
  canShare,
  sharingEnabled,
  disabled,
  onClose,
  onChange,
}: {
  projectKey: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  canChange: boolean;
  canShare: boolean;
  sharingEnabled: boolean;
  disabled: boolean;
  onClose: () => void;
  onChange: (isPrivate: boolean, memberIds?: string[]) => void;
}) {
  const t = useTranslations('documents');
  const tShare = useTranslations('common.share');
  // What the options show, which is not always the saved state: "Specific people" only
  // opens the picker, and nothing is saved until someone is added.
  const [draft, setDraft] = useState<DocumentVisibility | null>(null);
  // A change that revokes the public link, until the owner confirms it.
  const [pending, setPending] = useState<DocumentVisibility | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mode = draft ?? document.visibility;

  function apply(next: DocumentVisibility) {
    setPending(null);
    if (next === 'restricted') {
      setDraft('restricted');
      setPickerOpen(true);
      return;
    }
    setDraft(null);
    setPickerOpen(false);
    if (next === document.visibility) return;
    // A page opened to the whole project keeps no members; the API clears them.
    if (next === 'public') onChange(false);
    else onChange(true, []);
  }

  function pick(next: DocumentVisibility) {
    if (next === mode) return;
    if (next !== 'public' && document.shareToken !== null) setPending(next);
    else apply(next);
  }

  async function copyLink() {
    if (await copyText(shareUrl(documentPath(projectKey, document.id))))
      toast.success(t('access.linkCopied'));
    else toast.error(tShare('copyFailed'));
  }

  return (
    <div className="divide-y">
      <DocumentAccessSection label={t('access.whoCanOpen')}>
        {canChange ? (
          <DocumentAccessOptions
            projectKey={projectKey}
            memberIds={document.memberIds}
            mode={mode}
            pending={pending}
            disabled={disabled}
            pickerOpen={pickerOpen}
            onPickerOpenChange={setPickerOpen}
            onPick={pick}
            onConfirm={() => pending && apply(pending)}
            onCancel={() => setPending(null)}
            onMembersChange={(memberIds) => {
              // Removing the last person makes the page private; the picker stays open.
              setDraft('restricted');
              onChange(true, memberIds);
            }}
          />
        ) : (
          <DocumentAccessReadOnly document={document} />
        )}
      </DocumentAccessSection>
      {canShare && (
        <DocumentPublicLink
          projectKey={projectKey}
          document={document}
          ancestors={ancestors}
          sharingEnabled={sharingEnabled}
          projectPagesOnly={mode !== 'public' || pending !== null}
          onClose={onClose}
        />
      )}
      <div className="px-2.5 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-[13px] text-muted-foreground"
          onClick={() => void copyLink()}
        >
          <Link2 />
          {t('copyLink')}
        </Button>
      </div>
    </div>
  );
}
