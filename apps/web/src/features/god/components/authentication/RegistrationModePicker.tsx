import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RegistrationMode } from '@/lib/api';
import { cn } from '@/lib/utils';

const MODES: RegistrationMode[] = ['open', 'invite', 'closed'];

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
  const t = useTranslations('god.authentication.modes');

  return (
    <div role="radiogroup">
      {MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
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
              <span className="block text-sm font-medium">{t(`${mode}.label`)}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`${mode}.description`)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
