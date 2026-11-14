import type { ComponentType } from 'react';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';

// The panel that creates a tool of a source (`tool` null) or opens one it defines.
export interface ToolEditorProps {
  teamId: number;
  tool: ConfiguredTool | null;
  onClose: () => void;
}

// A kind of tool a team defines itself, beside the catalog's: `key` is the `source` its
// tools carry. A locked source is one another edition has: its button carries a lock and
// opens the page about that edition, and its tools say they need it.
export type ToolSourceEntry =
  | { kind: 'source'; key: string; label: string; Editor: ComponentType<ToolEditorProps> }
  | { kind: 'locked'; key: string; label: string; hint: string };
