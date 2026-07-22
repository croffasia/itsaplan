import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SettingsInlineEditForm({
  name,
  onNameChange,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  leading,
  trailing,
}: {
  name: string;
  onNameChange: (v: string) => void;
  placeholder: string;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      {leading}
      <Input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={placeholder}
        className="h-7"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      {trailing}
      <Button variant="ghost" size="sm" className="h-7" disabled={!name.trim()} onClick={onSubmit}>
        {submitLabel}
      </Button>
      <Button variant="ghost" size="sm" className="h-7" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
