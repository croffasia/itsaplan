import { FolderKanban } from 'lucide-react';
import type { ReachableGitRepository } from '@/lib/api/endpoints/git';

// A repository on its host, with the projects that sync with it.
export default function GitRepositoryRow({ repository }: { repository: ReachableGitRepository }) {
  return (
    <div className="flex min-h-8.5 items-center gap-3 text-sm">
      <a
        href={repository.webUrl}
        target="_blank"
        rel="noreferrer"
        dir="ltr"
        className="min-w-0 flex-1 wrap-anywhere decoration-muted-foreground underline-offset-3 hover:underline"
      >
        {repository.fullName}
      </a>
      {repository.projects.length > 0 && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <FolderKanban className="size-3.5" />
          <span dir="auto">{repository.projects.map((project) => project.name).join(', ')}</span>
        </span>
      )}
    </div>
  );
}
