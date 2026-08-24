'use client';

import { useRef, useState } from 'react';
import { Clock, Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatMinutes, parseMinutes, parsePoints } from '@/utils/estimate';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/common/fields/Pill';
import ReadOnlyPill from '@/components/common/fields/ReadOnlyPill';

const KINDS = {
  points: { icon: <Hash />, format: (value: number) => String(value), parse: parsePoints },
  time: { icon: <Clock />, format: formatMinutes, parse: parseMinutes },
};

export type EstimateKind = keyof typeof KINDS;

// One estimate on the issue: a pill showing the value, turning into a text field
// when clicked. An empty field clears the estimate; text the kind cannot read
// leaves the stored value alone.
export default function EstimatePill({
  kind,
  value,
  onChange,
  readOnly,
}: {
  kind: EstimateKind;
  value: number | null;
  onChange: (value: number | null) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fields');
  const { icon, format, parse } = KINDS[kind];
  const placeholder = kind === 'points' ? t('estimatePoints') : t('estimateTimePlaceholder');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // Escape leaves the field through blur as well, and the blur must not save.
  const canceled = useRef(false);

  function startEditing() {
    setDraft(value == null ? '' : format(value));
    canceled.current = false;
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (canceled.current) return;
    const text = draft.trim();
    const next = text === '' ? null : parse(text);
    if (text !== '' && next == null) return;
    if (next !== value) onChange(next);
  }

  const pill = (
    <Pill active={value != null} onClick={startEditing}>
      {icon}
      <span className="truncate">{value == null ? placeholder : format(value)}</span>
    </Pill>
  );

  if (readOnly) return <ReadOnlyPill>{pill}</ReadOnlyPill>;
  if (!editing) return pill;
  return (
    <Input
      autoFocus
      value={draft}
      placeholder={placeholder}
      className="h-7 rounded-full"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') canceled.current = true;
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
    />
  );
}
