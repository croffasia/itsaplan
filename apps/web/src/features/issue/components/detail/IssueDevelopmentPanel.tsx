import { type DevelopmentLink } from '@/lib/api';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import IssueDevelopmentLinkCard from './IssueDevelopmentLinkCard';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

export default function IssueDevelopmentPanel({
  issueId,
  links,
  canEdit,
}: {
  issueId: number;
  links: DevelopmentLink[];
  canEdit: boolean;
}) {
  const t = useTranslations('issue.development');
  const { open, toggle } = usePersistedOpen('issue-development-open');
  if (links.length === 0) return null;

  return (
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      <div className={`flex h-7 items-center ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading
          label={t('title')}
          tally={String(links.length)}
          open={open}
          onToggle={toggle}
        />
      </div>
      {open && (
        <div className="space-y-2">
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
    </div>
  );
}
