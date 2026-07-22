import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SettingsInlineForm({
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
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-2">
      {leading}
      <Input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 flex-1 bg-background"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      {trailing}
      <Button variant="ghost" size="sm" className="h-8" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" className="h-8" disabled={!name.trim()} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
