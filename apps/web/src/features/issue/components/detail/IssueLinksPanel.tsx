import { useState } from 'react';
import { Plus } from 'lucide-react';
import { type IssueLink, type IssueLinkInputKind, type ProjectDetail } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LINK_RELATIONS, LINK_RELATION_LABELS, linkRelation, storedKind } from '@/utils/issueLinks';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import { useUnlinkIssues } from '../../services/links.service';
import IssueLinkDialog from './IssueLinkDialog';
import IssueLinkRow from './IssueLinkRow';
import IssueSectionHeading from './IssueSectionHeading';

// The issue's relations to other issues, grouped by how each reads from this
// issue (Blocked by, Blocks, Duplicates, Duplicated by, Related). The links come
// with the issue, so the panel takes them rather than fetching them. The heading
// collapses the section, the same way the Stats one below it does; unlike Stats,
// which reads the account preferences, this is a client-only choice.
export default function IssueLinksPanel({
  project,
  issueId,
  links,
}: {
  project: ProjectDetail;
  issueId: number;
  links: IssueLink[];
}) {
  const { can } = usePermissions();
  const canEdit = can('work_items', 'edit');
  const [adding, setAdding] = useState<IssueLinkInputKind | null>(null);
  const { open, toggle } = usePersistedOpen('issue-links-open');
  const unlinkIssues = useUnlinkIssues();

  const groups = LINK_RELATIONS.map((relation) => ({
    relation,
    links: links.filter((link) => linkRelation(link) === relation),
  })).filter((group) => group.links.length > 0);

  return (
    // Collapsed, the heading row is all there is, so the section pulls itself up
    // against the Stats section below: the heading would otherwise sit off-centre
    // between its own padding above and that section's margin below.
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      {/* Fixed height: the Add button only renders while the section is open, and
          without it the row would shrink to the height of the heading text. */}
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading label="Links" open={open} onToggle={toggle} />
        {open && canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <Plus className="size-4" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {LINK_RELATIONS.map((relation) => (
                <DropdownMenuItem key={relation} onSelect={() => setAdding(relation)}>
                  {LINK_RELATION_LABELS[relation]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open &&
        (links.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Use Add to link an issue that blocks, duplicates or relates to this one.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.relation}>
                <h4 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                  {LINK_RELATION_LABELS[group.relation]}
                </h4>
                {group.links.map((link) => (
                  <IssueLinkRow
                    key={link.id}
                    project={project}
                    link={link}
                    onRemove={
                      canEdit
                        ? () =>
                            unlinkIssues.mutate({
                              projectKey: project.project.key,
                              issueId,
                              otherIssueId: link.issue.id,
                              linkId: link.id,
                            })
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        ))}

      {adding && (
        <IssueLinkDialog
          project={project}
          issueId={issueId}
          relation={adding}
          linkedIssueIds={
            new Set(
              links.filter((link) => link.kind === storedKind(adding)).map((link) => link.issue.id),
            )
          }
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}
