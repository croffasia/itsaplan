import { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Pill } from '@/components/common/fields/Pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A bare domain typed without a scheme is treated as https; the API accepts only
// absolute http(s) URLs.
function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Url custom field: a ghost pill showing the link with an open-in-new-tab icon;
// editing switches to a url input that validates on save (invalid keeps editing
// with an error ring). The API rejects a non-http(s) value, so validate here too.
export default function InlineUrlField({
  value,
  saveKey,
  onSave,
}: {
  value: string | null;
  saveKey: string;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const display = value === '' || value == null ? null : value;

  function start() {
    setDraft(display ?? '');
    setInvalid(false);
    setEditing(true);
  }

  function commit() {
    if (draft.trim() === '') {
      onSave(null);
      setEditing(false);
      return;
    }
    const normalized = normalizeUrl(draft);
    if (!isHttpUrl(normalized)) {
      setInvalid(true);
      return;
    }
    onSave(normalized);
    setEditing(false);
  }

  if (!editing) {
    if (display == null) {
      return (
        <Pill onClick={start}>
          <span>Empty</span>
        </Pill>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <Pill active onClick={start}>
          <span className="max-w-[200px] truncate">{display}</span>
        </Pill>
        <a
          href={display}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="url"
        autoFocus
        value={draft}
        key={saveKey}
        aria-invalid={invalid || undefined}
        placeholder="https://…"
        className="h-8 max-w-[240px]"
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={() => setEditing(false)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        title="Save"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
      >
        <Check className="size-4" />
      </Button>
    </div>
  );
}
