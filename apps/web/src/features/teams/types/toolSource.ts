import type { ComponentType } from 'react';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';

// The panel that creates a tool of a source (`tool` null) or opens one it defines.
export interface ToolEditorProps {
  teamId: number;
  tool: ConfiguredTool | null;
  onClose: () => void;
  // Given the configured tool id of a new tool once it is saved. The agent editor turns the
  // tool on for its agent.
  onCreated?: (toolId: number) => void;
}

export interface ToolRowProps {
  tool: ConfiguredTool;
  // The catalog entry, absent for a tool the team defines or one the catalog no longer has.
  meta: IntegrationMeta['tools'][number] | undefined;
  integration: Pick<IntegrationMeta, 'label' | 'kind' | 'icon'>;
  // The tool comes from a source another edition has.
  locked: boolean;
  canDelete: boolean;
  // Opens a tool the team defines in its source's panel.
  onOpen?: () => void;
  onDelete: () => void;
}

// The button a source puts beside the catalog's, in the Tools page's header and in the agent
// editor. The editor draws it inside its form, so it is `type="button"`.
export type ToolCreateButton = ComponentType<{ onCreate: () => void }>;

// A kind of tool a team defines itself, beside the catalog's: `key` is the `source` its
// tools carry. Its `CreateButton` opens `Editor` on a new tool; `Row`, when given, draws its
// tools in the list in place of the core's row. A locked source is one another edition has:
// its button says what that edition brings, and its tools say they need it.
export type ToolSourceEntry =
  | {
      kind: 'source';
      key: string;
      CreateButton: ToolCreateButton;
      Editor: ComponentType<ToolEditorProps>;
      Row?: ComponentType<ToolRowProps>;
    }
  | { kind: 'locked'; key: string; CreateButton: ToolCreateButton };
