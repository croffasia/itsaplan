import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

// A masked input for a secret (SMTP password, API key, bot token). The stored value
// is never sent to the client, so the field starts empty: when a value is already
// saved, the placeholder shows dots and leaving the field blank keeps the stored
// secret. An eye toggle reveals what the user is typing.
export default function SecretInput({
  id,
  value,
  onChange,
  hasStored,
  editable,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hasStored: boolean;
  editable: boolean;
  placeholder?: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        placeholder={hasStored ? '••••••••••••' : placeholder}
        className="pr-9"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={reveal ? 'Hide' : 'Show'}
        tabIndex={-1}
      >
        {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
