'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { toHex } from '@/utils/colorThemes';

// A color of the custom palette: the browser's color picker, and the hex code for
// pasting an exact color. A half-typed code stays in the field until it is complete.
export default function AccountCustomThemeColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);

  return (
    <div className="flex w-full items-center gap-2 sm:w-44" dir="ltr">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
      <Input
        value={typed ?? value}
        onChange={(e) => {
          setTyped(e.target.value);
          const hex = toHex(e.target.value);
          if (hex) onChange(hex);
        }}
        onBlur={() => setTyped(null)}
        aria-label={label}
        spellCheck={false}
        className="font-mono text-xs uppercase"
      />
    </div>
  );
}
