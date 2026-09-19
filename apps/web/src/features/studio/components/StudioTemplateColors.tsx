'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FIELDS = [
  { key: 'backgroundColor', label: 'Background' },
  { key: 'textColor', label: 'Text' },
  { key: 'accentColor', label: 'Accent' },
] as const;

export default function StudioTemplateColors({
  backgroundColor,
  textColor,
  accentColor,
  onChange,
}: {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  onChange: (key: 'backgroundColor' | 'textColor' | 'accentColor', value: string) => void;
}) {
  const values: Record<(typeof FIELDS)[number]['key'], string> = {
    backgroundColor,
    textColor,
    accentColor,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={`template-${field.key}`}>{field.label}</Label>
          <div className="flex items-center gap-2">
            <input
              id={`template-${field.key}`}
              type="color"
              value={values[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent"
            />
            <Input
              value={values[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="font-mono"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
