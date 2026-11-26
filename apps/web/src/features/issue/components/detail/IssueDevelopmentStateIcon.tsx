import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from 'lucide-react';
import type { DevelopmentLinkState } from '../../utils/development';
import { cn } from '@/lib/utils';

const ICONS = {
  branch: GitBranch,
  draft: GitPullRequestDraft,
  merged: GitMerge,
  closed: GitPullRequestClosed,
  open: GitPullRequest,
} satisfies Record<DevelopmentLinkState, typeof GitBranch>;

const COLORS = {
  branch: 'text-muted-foreground/70',
  draft: 'text-muted-foreground/70',
  merged: 'text-violet-600 dark:text-violet-400',
  closed: 'text-red-600 dark:text-red-400',
  open: 'text-emerald-600 dark:text-emerald-400',
} satisfies Record<DevelopmentLinkState, string>;

// The leading icon of a linked branch or pull request, coloured by where it stands.
export default function IssueDevelopmentStateIcon({
  state,
  className,
}: {
  state: DevelopmentLinkState;
  className?: string;
}) {
  const Icon = ICONS[state];
  return <Icon className={cn('size-4 shrink-0', COLORS[state], className)} />;
}
