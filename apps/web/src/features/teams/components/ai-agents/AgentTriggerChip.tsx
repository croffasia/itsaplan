import type { ComponentType } from 'react';

// The look of a trigger, shared with the field-trigger chip, which is a popover trigger
// rather than a plain mark.
export const TRIGGER_CHIP = 'inline-flex items-center gap-1 text-xs text-muted-foreground';

export function AgentTriggerChip({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className={TRIGGER_CHIP}>
      <Icon className="size-3 shrink-0" />
      {label}
    </span>
  );
}
