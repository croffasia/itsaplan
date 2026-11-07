import type { CrossProjectIssueHit } from '@/lib/api/endpoints/issues';
import CommandPaletteIssues from './CommandPaletteIssues';

// The other projects' hits, one group per project in the order the server ranks
// their best hit. Values are numbered across the groups, after the current project's
// group, so they stay unique and cmdk keeps that order.
export default function CommandPaletteOtherIssues({
  hits,
  fetching,
  loadingHeading,
  onOpenIssue,
}: {
  hits: CrossProjectIssueHit[];
  fetching: boolean;
  loadingHeading: string;
  onOpenIssue: (hit: CrossProjectIssueHit) => void;
}) {
  if (hits.length === 0) {
    return (
      <CommandPaletteIssues
        heading={loadingHeading}
        hits={[]}
        fetching={fetching}
        valueOffset={1000}
        onOpenIssue={onOpenIssue}
      />
    );
  }
  const groups = new Map<number, CrossProjectIssueHit[]>();
  for (const hit of hits) {
    const group = groups.get(hit.projectId);
    if (group) group.push(hit);
    else groups.set(hit.projectId, [hit]);
  }
  let offset = 1000;
  return [...groups.values()].map((group) => {
    const [first] = group;
    const valueOffset = offset;
    offset += group.length;
    return (
      <CommandPaletteIssues
        key={first!.projectId}
        heading={
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">
              {first!.teamName} / {first!.projectName}
            </span>
            <span className="shrink-0 font-mono">{first!.projectKey}</span>
          </span>
        }
        hits={group}
        fetching={false}
        valueOffset={valueOffset}
        onOpenIssue={onOpenIssue}
      />
    );
  });
}
