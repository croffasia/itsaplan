import {
  useIssuePropertyRows,
  type IssuePropertyRowsInput,
} from '../../hooks/useIssuePropertyRows';
import IssuePropertyRow from './IssuePropertyRow';

// The properties of the side panel, under the description: every control that names
// its own field in one wrapping row of pills, without the names column or the group
// headings of the Properties grid. A custom field and the time tracked still need
// their names, so they follow the row as name and value, and a markdown field as a
// block of its own.
export default function IssuePropertyPills(input: IssuePropertyRowsInput) {
  const rows = useIssuePropertyRows(input).flatMap((group) => group.rows);
  const pills = rows.filter((row) => row.kind === 'pill');
  const named = rows.filter((row) => row.kind === 'named');
  const blocks = rows.filter((row) => row.kind === 'block');

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {pills.map((row) => (
          <div key={row.key} className="min-w-0">
            {row.node}
          </div>
        ))}
      </div>
      {named.length > 0 && (
        <div className="mt-3 grid grid-cols-[minmax(0,min(40%,180px))_minmax(0,1fr)] items-start gap-x-2 gap-y-2.5">
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
    </div>
  );
}
