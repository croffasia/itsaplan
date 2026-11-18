'use client';

import { useState } from 'react';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Input } from '@/components/ui/input';
import { wholeNumberIn } from '../../utils/numbers';

// A settings row whose control is a typed whole number from 0 to `max`, saved on leaving
// the field or Enter rather than on each key. `zeroNote` is shown while the field holds 0.
export default function GodLimitRow({
  title,
  description,
  value,
  max,
  invalidNote,
  zeroNote,
  disabled,
  className,
  onSave,
}: {
  title: string;
  description: string;
  value: number;
  max: number;
  invalidNote: string;
  zeroNote?: string;
  disabled: boolean;
  className: string;
  onSave: (value: number) => Promise<void>;
}) {
  // The number as typed, or null while it shows the stored one.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const valid = wholeNumberIn(shown, 0, max);

  async function save() {
    if (draft === null || !valid) return;
    if (Number(draft) !== value) await onSave(Number(draft));
    setDraft(null);
  }

  return (
    <SettingsRow
      title={title}
      description={description}
      note={!valid ? invalidNote : Number(shown) === 0 ? zeroNote : undefined}
      control={
        <Input
          type="number"
          min={0}
          max={max}
          step={1}
          inputMode="numeric"
          className={className}
          aria-label={title}
          aria-invalid={!valid}
          value={shown}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
        />
      }
    />
  );
}
