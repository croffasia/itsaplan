import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function GodSamlField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
