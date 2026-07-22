import { Check } from 'lucide-react';
import type { RegistrationMode } from '@/lib/api';
import { cn } from '@/lib/utils';

const OPTIONS: { value: RegistrationMode; label: string; description: string }[] = [
  {
    value: 'open',
    label: 'Open',
    description: 'Anyone who reaches the sign-up page can create an account.',
  },
  {
    value: 'invite',
    label: 'Invite only',
    description: 'An account can only be created through an invite link.',
  },
  {
    value: 'closed',
    label: 'Closed',
    description: 'No new accounts. Existing ones keep signing in.',
  },
];

// Picks how the instance handles registration. One choice of three, each with a
// sentence explaining what it means for someone opening the sign-up page. Renders bare
// rows — the caller wraps them in a SettingsCard.
export default function RegistrationModePicker({
  value,
  onChange,
  disabled,
}: {
  value: RegistrationMode;
  onChange: (value: RegistrationMode) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex w-full items-start gap-3 p-4 text-left transition-colors',
              '-outline-offset-1 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
              // The choice reads from the fill, not from a box around it. The rows sit
              // inside a SettingsCard, which supplies the dividers and the rounding.
              active ? 'bg-accent' : 'hover:bg-accent/40',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              )}
            >
              {active && <Check className="size-3" />}
            </span>
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
