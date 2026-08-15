import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uuid } from '@/utils/uuid';

// One row of the editor. `key` is local and stable across edits, so typing in a row
// does not move the focus when the rows above it change; `id` is the option's own id,
// absent on a row that does not exist yet.
export interface OptionDraft {
  key: string;
  id?: number;
  value: string;
}

// Splits the comma-separated field into option values, dropping the blanks.
export function parseOptionValues(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

// The options of a select field: one row per option, renamed in place or removed,
// plus a field that takes several new ones at once. What the add field still holds
// when the form is submitted counts as typed, so a quick "Low, Medium, High" needs
// no extra click.
export default function FieldOptionsEditor({
  options,
  onChange,
  pending,
  onPendingChange,
}: {
  options: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
  // The add field's text, held by the form so submitting can pick it up.
  pending: string;
  onPendingChange: (value: string) => void;
}) {
  const t = useTranslations('settings.customFields');

  function commitPending() {
    const values = parseOptionValues(pending);
    if (values.length === 0) return;
    onChange([...options, ...values.map((value) => ({ key: uuid(), value }))]);
    onPendingChange('');
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="custom-field-options">{t('options')}</Label>

      {options.length > 0 && (
        <div className="space-y-1">
          {options.map((option, index) => (
            <div key={option.key} className="flex items-center gap-1">
              <Input
                value={option.value}
                onChange={(e) =>
                  onChange(
                    options.map((o, i) => (i === index ? { ...o, value: e.target.value } : o)),
                  )
                }
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={t('removeOption', { value: option.value })}
                onClick={() => onChange(options.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Input
        id="custom-field-options"
        value={pending}
        onChange={(e) => onPendingChange(e.target.value)}
        onBlur={commitPending}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // Enter belongs to the option being typed, not to the form.
          e.preventDefault();
          commitPending();
        }}
        placeholder={t('optionsPlaceholder')}
        className="h-9"
      />
      <p className="text-xs text-muted-foreground">{t('optionsHint')}</p>
    </div>
  );
}
