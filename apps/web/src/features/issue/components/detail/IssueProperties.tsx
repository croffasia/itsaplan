import { Fragment } from 'react';
import type { IssuePropertyRowsInput } from '../../hooks/useIssuePropertyRows';
import { useIssueVisibleProperties } from '../../hooks/useIssueVisibleProperties';
import { BARE_PILLS } from '../../utils/barePills';
import { summaryRows } from '../../utils/propertySummary';
import IssueAddFieldMenu from './IssueAddFieldMenu';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSection from './IssueSection';
import IssueSectionHeading from './IssueSectionHeading';
import IssuePropertyRow from './IssuePropertyRow';
import IssuePropertyGroupHeading from './IssuePropertyGroupHeading';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// The name column takes a share of whatever room the section has, capped at the width
// long names need, so a narrow sidebar leaves the controls enough space instead of
// pushing them out of it.
const GRID = cn(
  'grid grid-cols-[minmax(0,min(40%,180px))_minmax(0,1fr)] items-start gap-x-2 gap-y-1',
  BARE_PILLS,
);

// The Properties grid of the issue detail: built-in fields and non-markdown custom
// fields as name and value, each editable inline. The fields most issues use always
// show; an optional built-in field or a custom field shows once it holds a value, and
// the plus on the heading adds an empty one. Folded, the state, priority, people and
// due date stay in view as rows under one group. Shaped like the Attachments and
// Links sections — same heading, same separator above it, same collapsing — in the
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
  const tFields = useTranslations('issue.customFields');
  const properties = useIssueVisibleProperties({ ...input, named: true }, 'all');
  const groups = properties.groups
    .map((group) => ({ ...group, rows: group.rows.filter((row) => !properties.isHidden(row)) }))
    .filter((group) => group.rows.length > 0);

  const add = (key: string | number) => {
    if (!open) onToggle();
    const group = properties.groups.find((g) => g.rows.some((row) => row.key === key));
    if (group && !groupsOpen.isOpen(group.key)) groupsOpen.toggle(group.key);
    properties.add(key);
  };

  return (
    // Folded, the section still shows its main rows, so it keeps the spacing of an open one.
    <IssueSection collapsed={false} className={className}>
      <IssueSectionHeading
        label={t('properties')}
        open={open}
        onToggle={onToggle}
        actions={
          !input.readOnly &&
          properties.addable.length > 0 && (
            <IssueAddFieldMenu groups={properties.addable} onPick={add}>
              <IssueSectionAddButton label={tFields('addField')} />
            </IssueAddFieldMenu>
          )
        }
      />
      {!open && (
        <div className={cn(GRID, 'mt-2')}>
          {/* One group, only a name, for the rows a folded section keeps. */}
          <IssuePropertyGroupHeading label={t('groupSummary')} />
          {summaryRows(properties.groups.flatMap((group) => group.rows)).map((row) => (
            <IssuePropertyRow key={row.key} label={row.label}>
              {row.node}
            </IssuePropertyRow>
          ))}
        </div>
      )}
      {open && (
        <div className={GRID}>
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
