'use client';

import { useMemo } from 'react';
import type { Release } from '@/lib/api/endpoints/updates';
import type { TakeoverSection } from '@/components/common/page/TakeoverScreen';
import { renderMarkdown, sanitizeHtml } from '@/lib/markdown';
import { isNewerVersion } from '@/utils/version';
import { formatDate } from '@/utils/dates';

// One release's notes. They arrive as rendered HTML from the release feed and as
// markdown from the changelog of this build; both end up sanitized.
function ReleaseBody({ release, empty }: { release: Release; empty: string }) {
  const html = useMemo(() => {
    const options = { newTabLinks: true };
    return release.notesFormat === 'html'
      ? sanitizeHtml(release.notes, options)
      : renderMarkdown(release.notes, options);
  }, [release.notes, release.notesFormat]);

  if (!html) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="md-content max-w-[68ch]" dangerouslySetInnerHTML={{ __html: html }} />;
}

// The running release is the reader's, the ones above it are not installed yet.
function tone(release: Release, current?: string): TakeoverSection['tone'] {
  if (!current) return undefined;
  if (release.version === current) return 'current';
  return isNewerVersion(release.version, current) ? 'new' : undefined;
}

// The releases as sections of the screen, newest first. `badges` names the two the
// reader has to tell apart from the rest — the running version in the history, the
// ones above it that are not installed yet.
export function releaseSections(
  releases: Release[],
  labels: {
    empty: string;
    // The version the instance runs, which is what makes a release current or new.
    current?: string;
    badges?: Record<NonNullable<TakeoverSection['tone']>, string>;
  },
): TakeoverSection[] {
  return releases.map((release) => {
    const releaseTone = tone(release, labels.current);
    return {
      id: release.tag,
      title: release.tag,
      href: release.url ?? undefined,
      badge: releaseTone && labels.badges?.[releaseTone],
      tone: releaseTone,
      description: release.publishedAt ? formatDate(release.publishedAt) : undefined,
      body: <ReleaseBody release={release} empty={labels.empty} />,
    };
  });
}
