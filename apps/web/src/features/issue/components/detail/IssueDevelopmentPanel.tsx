import { useState } from 'react';
import { type DevelopmentLink } from '@/lib/api';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import IssueDevelopmentAddMenu from './IssueDevelopmentAddMenu';
import IssueDevelopmentCreateDialog from './IssueDevelopmentCreateDialog';
import IssueDevelopmentLinkCard from './IssueDevelopmentLinkCard';
import IssueDevelopmentLinkDialog from './IssueDevelopmentLinkDialog';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

export default function IssueDevelopmentPanel({
  issueId,
  identifier,
  issueTitle,
  links,
  canEdit,
  canManage,
}: {
  issueId: number;
  identifier: string;
  issueTitle: string;
  links: DevelopmentLink[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const t = useTranslations('issue.development');
  const { open, toggle } = usePersistedOpen('issue-development-open');
  const [linkOpen, setLinkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  if (links.length === 0 && !canManage) return null;

  return (
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading
          label={t('title')}
          tally={String(links.length)}
          open={open}
          onToggle={toggle}
        />
        {canManage && (
          <IssueDevelopmentAddMenu
            onLink={() => setLinkOpen(true)}
            onCreate={() => setCreateOpen(true)}
          />
        )}
      </div>
      {open && (
        <div className="space-y-2">
          {links.length === 0 && (
            <button
              type="button"
              className="w-full rounded-md border border-dashed px-4 py-5 text-center text-sm text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
              onClick={() => setLinkOpen(true)}
            >
              {t('empty')}
            </button>
          )}
          {links.map((link) => (
            <IssueDevelopmentLinkCard
              key={link.id}
              issueId={issueId}
              link={link}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
      <IssueDevelopmentLinkDialog issueId={issueId} open={linkOpen} onOpenChange={setLinkOpen} />
      <IssueDevelopmentCreateDialog
        issueId={issueId}
        identifier={identifier}
        issueTitle={issueTitle}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
