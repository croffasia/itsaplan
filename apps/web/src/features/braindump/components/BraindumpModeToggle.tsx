import { Mic, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CaptureMode } from '../hooks/useBraindumpCapture';

export default function BraindumpModeToggle({
  mode,
  voiceAvailable,
  onChange,
}: {
  mode: CaptureMode;
  voiceAvailable: boolean;
  onChange: (mode: CaptureMode) => void;
}) {
  const options: { value: CaptureMode; label: string; icon: typeof Type; disabled: boolean }[] = [
    { value: 'type', label: 'Type', icon: Type, disabled: false },
    { value: 'voice', label: 'Voice', icon: Mic, disabled: !voiceAvailable },
  ];

  return (
    <div className="inline-flex rounded-full border p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={mode === option.value ? 'secondary' : 'ghost'}
          aria-pressed={mode === option.value}
          disabled={option.disabled}
          className="h-7 rounded-full px-3 text-xs font-normal"
          onClick={() => onChange(option.value)}
        >
          <option.icon className="size-3.5" />
          {option.label}
        </Button>
      ))}
    </div>
  );
}
