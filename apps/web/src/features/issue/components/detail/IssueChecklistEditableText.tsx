import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// A checklist title or item text, edited in place. Reads as plain text until it is
// clicked; Enter and blur commit, Escape puts the original back. An empty value is
// not a delete — it reverts, since deleting has its own control.
export default function IssueChecklistEditableText({
  value,
  maxLength,
  onCommit,
  readOnly,
  className,
}: {
  value: string;
  // Matches the API's own bound on this field.
  maxLength: number;
  onCommit: (next: string) => void;
  readOnly: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
    setEditing(false);
  }

  if (readOnly) return <span className={className}>{value}</span>;

  if (!editing)
    return (
      <button
        type="button"
        className={cn('flex-1 cursor-text truncate text-left', className)}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </button>
    );

  return (
    <input
      ref={ref}
      value={draft}
      maxLength={maxLength}
      className={cn(
        'flex-1 rounded-sm bg-transparent ring-1 ring-ring/40 outline-none focus:ring-ring',
        className,
      )}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
