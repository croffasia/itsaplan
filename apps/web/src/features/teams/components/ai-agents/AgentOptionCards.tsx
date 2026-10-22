import type { LucideIcon } from 'lucide-react';

interface AgentOption<T extends string> {
  value: T;
  icon: LucideIcon;
  label: string;
  hint: string;
}

// A choice between two options shown side by side, each with an icon, a name and a
// one-line hint: the kind of a new agent, and how an external one gets its tasks.
export function AgentOptionCards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: AgentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-start text-sm transition-colors ${
              value === option.value
                ? 'bg-secondary ring-1 ring-foreground/15'
                : 'bg-muted/50 hover:bg-accent/60'
            }`}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
