import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { cn } from '@/lib/utils';
import type { IssuePropertyRowsInput } from '../../hooks/useIssuePropertyRows';
import { useIssueVisibleProperties } from '../../hooks/useIssueVisibleProperties';
import { BARE_PILLS } from '../../utils/barePills';
import IssueAddFieldMenu from './IssueAddFieldMenu';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssuePropertyRow from './IssuePropertyRow';
import IssuePropertySummary from './IssuePropertySummary';
import IssueSection from './IssueSection';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

// The Properties section of the side panel. Open, it shows every control that names
// its own field in one wrapping row of pills, then the custom fields that hold a value
// as name and value, and a markdown field as a block; the plus on the heading adds an
// empty one. Folded, a row under the heading keeps the state, priority, people and due
// date, still editable.
export default function IssuePanelProperties(input: IssuePropertyRowsInput) {
  const t = useTranslations('issue.fields');
  const tFields = useTranslations('issue.customFields');
  const section = usePersistedOpen('issue-panel-properties-open');
  const properties = useIssueVisibleProperties(input, 'custom');
  const rows = properties.groups.flatMap((group) => group.rows);
  const shown = rows.filter((row) => !properties.isHidden(row));
  const pills = shown.filter((row) => row.kind === 'pill');
  const named = shown.filter((row) => row.kind === 'named');
  const blocks = shown.filter((row) => row.kind === 'block');

  return (
    // Folded, the section still shows a row of fields, so it keeps the spacing of an open one.
    <IssueSection collapsed={false}>
      <IssueSectionHeading
        label={t('properties')}
        open={section.open}
        onToggle={section.toggle}
        actions={
          !input.readOnly &&
          properties.addable.length > 0 && (
            <IssueAddFieldMenu
              groups={properties.addable}
              onPick={(key) => {
                if (!section.open) section.toggle();
                properties.add(key);
              }}
            >
              <IssueSectionAddButton label={tFields('addField')} />
            </IssueAddFieldMenu>
          )
        }
      />
      {!section.open && <IssuePropertySummary rows={rows} className="mt-1" />}
      {section.open && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {pills.map((row) => (
              <div key={row.key} className="min-w-0">
                {row.node}
              </div>
            ))}
          </div>
          {named.length > 0 && (
            <div
              className={cn(
                'mt-3 grid grid-cols-[minmax(0,min(40%,180px))_minmax(0,1fr)] items-start gap-x-2 gap-y-1',
                BARE_PILLS,
              )}
            >
              {named.map((row) => (
                <IssuePropertyRow key={row.key} label={row.label}>
                  {row.node}
                </IssuePropertyRow>
              ))}
            </div>
          )}
          {blocks.map((row) => (
            <div key={row.key}>{row.node}</div>
          ))}
        </>
      )}
    </IssueSection>
  );
}
