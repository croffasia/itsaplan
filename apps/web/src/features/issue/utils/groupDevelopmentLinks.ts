import type { DevelopmentLink, PipelineStatus } from '@/lib/api/endpoints/git';

// CI/deploy branches are not review work: they fire a pipeline per environment
// and would otherwise sit next to merge requests as equal cards. A linked PR
// already covers its source branch, so that branch is not listed again.
const BUILD_BRANCH = /^(ci|stage|build|deploy|release|hotfix)\//;
const PIPELINE_TITLE = /^pipeline\s+#?\d+/i;

const PR_STATE_RANK: Record<DevelopmentLink['state'], number> = {
  open: 0,
  merged: 1,
  closed: 2,
};

const STATUS_RANK: Record<PipelineStatus, number> = {
  failed: 0,
  running: 1,
  pending: 2,
  canceled: 3,
  skipped: 4,
  success: 5,
};

export interface DevelopmentRepoBuilds {
  repository: string;
  links: DevelopmentLink[];
  status: PipelineStatus | null;
}

export interface GroupedDevelopmentLinks {
  pullRequests: DevelopmentLink[];
  workBranches: DevelopmentLink[];
  builds: DevelopmentLink[];
  buildsByRepo: DevelopmentRepoBuilds[];
}

export function developmentLinkStatus(link: DevelopmentLink): PipelineStatus | null {
  return link.pipelineStatus ?? link.checkStatus;
}

export function worstPipelineStatus(
  statuses: Array<PipelineStatus | null | undefined>,
): PipelineStatus | null {
  let worst: PipelineStatus | null = null;
  for (const status of statuses) {
    if (!status) continue;
    if (worst == null || STATUS_RANK[status] < STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

export function isBuildDevelopmentLink(link: DevelopmentLink): boolean {
  if (link.kind === 'pull_request') return false;
  const name = developmentBranchName(link) ?? '';
  return BUILD_BRANCH.test(name) || PIPELINE_TITLE.test(link.title);
}

export function groupDevelopmentLinks(links: DevelopmentLink[]): GroupedDevelopmentLinks {
  const pullRequests = links
    .filter((link) => link.kind === 'pull_request')
    .sort(comparePullRequests);
  const covered = new Set(
    pullRequests.flatMap((pr) => {
      const branch = developmentBranchName(pr);
      return branch ? [`${pr.repository}\0${branch}`] : [];
    }),
  );

  const leftover = links.filter((link) => {
    if (link.kind !== 'branch') return false;
    const branch = developmentBranchName(link);
    return !branch || !covered.has(`${link.repository}\0${branch}`);
  });

  const workBranches = leftover.filter((link) => !isBuildDevelopmentLink(link)).sort(byUpdated);
  const builds = leftover.filter(isBuildDevelopmentLink).sort(byUpdated);
  const buildsByRepo = groupBuildsByRepo(builds);

  return { pullRequests, workBranches, builds, buildsByRepo };
}

function developmentBranchName(link: DevelopmentLink): string | null {
  if (link.sourceBranch) return link.sourceBranch;
  return link.kind === 'branch' ? link.title : null;
}

function groupBuildsByRepo(builds: DevelopmentLink[]): DevelopmentRepoBuilds[] {
  const byRepo = new Map<string, DevelopmentLink[]>();
  for (const link of builds) {
    const list = byRepo.get(link.repository) ?? [];
    list.push(link);
    byRepo.set(link.repository, list);
  }
  return [...byRepo.entries()]
    .map(([repository, repoLinks]) => ({
      repository,
      links: repoLinks,
      status: worstPipelineStatus(repoLinks.map(developmentLinkStatus)),
    }))
    .sort((a, b) => byUpdated(a.links[0]!, b.links[0]!));
}

function comparePullRequests(a: DevelopmentLink, b: DevelopmentLink): number {
  if (a.state !== b.state) return PR_STATE_RANK[a.state] - PR_STATE_RANK[b.state];
  if (a.draft !== b.draft) return Number(a.draft) - Number(b.draft);
  return byUpdated(a, b);
}

function byUpdated(a: DevelopmentLink, b: DevelopmentLink): number {
  return b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id;
}
