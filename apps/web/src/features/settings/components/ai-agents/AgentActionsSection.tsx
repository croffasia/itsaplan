'use client';

import { ListChecks } from 'lucide-react';
import type { AgentTool } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { grantedToolCount } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';

// What the agent may do in the project. Read-only tools are always granted; the rest
// are opt-in. The counter shows the tools the agent actually has (the granted ones
// plus the always-on read tools) over the full catalog.
export default function AgentActionsSection({
  open,
  onOpenChange,
  tools,
  toolsLoading,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: AgentTool[];
  toolsLoading: boolean;
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const grantable = tools.filter((t) => !t.always);
  const activeCount = grantedToolCount(tools, selected);
  const allGranted = grantable.length > 0 && selected.length >= grantable.length;

  function toggleTool(key: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onChange([...next]);
  }

  return (
    <AgentFormSection
      id="actions"
      open={open}
      onOpenChange={onOpenChange}
      icon={ListChecks}
      title="Actions"
      hint="What the agent can do in the project"
      headerRight={tools.length > 0 ? `${activeCount} / ${tools.length}` : undefined}
    >
      {toolsLoading && <p className="text-xs text-muted-foreground">Loading actions…</p>}
      {!toolsLoading && tools.length === 0 && (
        <p className="text-xs text-muted-foreground">No actions available.</p>
      )}
      {!toolsLoading && tools.length > 0 && (
        <>
          {grantable.length > 0 && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => onChange(allGranted ? [] : grantable.map((t) => t.key))}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {allGranted ? 'Clear all' : 'Select all'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {tools.map((tool) =>
              tool.always ? (
                <Tooltip key={tool.key}>
                  <TooltipTrigger asChild>
                    <div className="flex items-start gap-2 opacity-70">
                      <Checkbox className="mt-0.5" checked disabled />
                      <span>
                        <span className="text-sm">{tool.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {tool.description}
                        </span>
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Read-only access is always on and can&apos;t be turned off.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <label key={tool.key} className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.includes(tool.key)}
                    onCheckedChange={(v) => toggleTool(tool.key, v === true)}
                  />
                  <span>
                    <span className="text-sm">{tool.label}</span>
                    <span className="block text-xs text-muted-foreground">{tool.description}</span>
                  </span>
                </label>
              ),
            )}
          </div>
        </>
      )}
    </AgentFormSection>
  );
}
