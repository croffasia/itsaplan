import { Fragment } from 'react';
import {
  useIssuePropertyRows,
  type IssuePropertyRowsInput,
} from '../../hooks/useIssuePropertyRows';
import IssueSection from './IssueSection';
import IssueSectionHeading from './IssueSectionHeading';
import IssuePropertyRow from './IssuePropertyRow';
import IssuePropertyGroupHeading from './IssuePropertyGroupHeading';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// The Properties grid of the issue detail: built-in fields and non-markdown
// custom fields, each editable inline. Shaped like the Attachments and Links
// sections — same heading, same separator above it, same collapsing — in the
// sidebar and in the single column alike.
export default function IssueProperties({
  className,
  open,
  onToggle,
  groupsOpen,
  ...input
}: IssuePropertyRowsInput & {
  // Spacing override for a sidebar, where the section follows the actions row
  // rather than a block of content and needs less room above it.
  className?: string;
  // Held by the parent: the page layout renders this section twice — in the
  // column below xl, in the sidebar from xl — and both have to agree.
  open: boolean;
  onToggle: () => void;
  // Which property groups are open, held by the parent for the same reason.
  groupsOpen: { isOpen: (key: string) => boolean; toggle: (key: string) => void };
}) {
  const t = useTranslations('issue.fields');
  const groups = useIssuePropertyRows(input);

  return (
    <IssueSection collapsed={!open} className={className}>
      <IssueSectionHeading label={t('properties')} open={open} onToggle={onToggle} />
      {open && (
        // The name column takes a share of whatever room the section has, capped at
        // the width long names need, so a narrow sidebar leaves the controls enough
        // space instead of pushing them out of it.
        <div className="grid grid-cols-[minmax(0,min(40%,180px))_minmax(0,1fr)] items-start gap-x-2 gap-y-2.5">
          {groups.map((group, i) => {
            const groupOpen = groupsOpen.isOpen(group.key);
            return (
              <Fragment key={group.key}>
                <IssuePropertyGroupHeading
                  label={t(group.key)}
                  className={cn(i > 0 && 'mt-2')}
                  open={groupOpen}
                  onToggle={() => groupsOpen.toggle(group.key)}
                />
                {groupOpen &&
                  group.rows.map((row) =>
                    row.kind === 'block' ? (
                      <div key={row.key} className="col-span-2">
                        {row.node}
                      </div>
                    ) : (
                      <IssuePropertyRow key={row.key} label={row.label}>
                        {row.node}
                      </IssuePropertyRow>
                    ),
                  )}
              </Fragment>
            );
          })}
        </div>
      )}
    </IssueSection>
  );
}
