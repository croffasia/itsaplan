'use client';

import type { ToolSourceEntry } from '@/features/teams/types/toolSource';
import ToolLockedCreateButton from '@/features/teams/components/agent-tools/ToolLockedCreateButton';

// A self-hosted instance defines no tools of its own; a locked entry says what the
// editions that do bring. The hosted build returns its own sources.
export default function useToolSources(): ToolSourceEntry[] {
  return [{ kind: 'locked', key: 'http', CreateButton: ToolLockedCreateButton }];
}
