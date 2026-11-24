'use client';

import { cn } from '@/lib/utils';

export const CODE_LENGTH = 6;

// The gallery's confirmation code as six cells. One input holds the whole code, so typing,
// pasting and the one-time-code autofill work as in a plain field.
export default function WorkspaceTemplateCodeInput({
  value,
  label,
  invalid,
  onChange,
}: {
  value: string;
  label: string;
  invalid: boolean;
  onChange: (code: string) => void;
}) {
  return (
    <div className="group relative flex gap-2" dir="ltr">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <span
          key={index}
          className={cn(
            'flex h-14 w-12 items-center justify-center rounded-lg border border-input font-mono text-xl font-medium dark:bg-input/30',
            index === value.length &&
              'group-focus-within:border-ring group-focus-within:ring-[3px] group-focus-within:ring-ring/50',
            invalid && 'border-destructive',
          )}
        >
          {value[index]}
        </span>
      ))}
      <input
        aria-label={label}
        aria-invalid={invalid}
        className="absolute inset-0 cursor-text opacity-0"
        value={value}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
      />
    </div>
  );
}
