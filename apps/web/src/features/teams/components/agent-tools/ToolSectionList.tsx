import type { ToolSection } from '../../utils/toolCatalog';
import { ToolRow } from './ToolRow';
import { ToolSelectAllButton } from './ToolSelectAllButton';

// The tools of one group of an integration, under the group's name when it has one.
export function ToolSectionList({
  section,
  selectable,
  added,
  selected,
  onToggle,
}: {
  section: ToolSection;
  selectable: boolean;
  added: string[];
  selected: string[];
  onToggle: (toolKeys: string[], on: boolean) => void;
}) {
  return (
    <div className="pb-1.5">
      {section.group && (
        <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-card px-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
            {section.group}
          </h4>
          <span className="text-xs text-muted-foreground tabular-nums">{section.tools.length}</span>
          {selectable && (
            <ToolSelectAllButton
              className="ms-auto"
              tools={section.tools.filter((o) => !added.includes(o.toolKey))}
              selected={selected}
              onToggle={onToggle}
            />
          )}
        </div>
      )}
      {section.tools.map((o) => (
        <ToolRow
          key={o.toolKey}
          tool={o}
          selectable={selectable}
          checked={selected.includes(o.toolKey)}
          added={added.includes(o.toolKey)}
          onToggle={(on) => onToggle([o.toolKey], on)}
        />
      ))}
    </div>
  );
}
