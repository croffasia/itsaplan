import type { LucideIcon } from 'lucide-react';

export interface AgentNavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  // Optional trailing indicator (e.g. the Actions enabled/total count).
  badge?: string;
}

// The sticky section rail for the full-width agent editor. It lists the form's
// sections, highlights the one currently in view (driven by the parent's scroll
// spy), and jumps to a section on click. Shown only on wide viewports where the
// three-column editor has room; the form stays fully usable without it.
export function AgentSectionNav({
  sections,
  activeId,
  onJump,
}: {
  sections: AgentNavSection[];
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <nav
      className="sticky top-2 hidden w-44 shrink-0 self-start lg:block"
      aria-label="Agent settings"
    >
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const active = section.id === activeId;
          const Icon = section.icon;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onJump(section.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                {section.badge && (
                  <span className="shrink-0 text-xs tabular-nums opacity-70">{section.badge}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
