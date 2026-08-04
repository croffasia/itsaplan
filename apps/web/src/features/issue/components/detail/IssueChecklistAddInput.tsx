import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

// The one-line input that adds a checklist or an item. Enter submits and keeps the
// field focused so a list can be typed in one go; Escape and blurring an empty
// field close it.
export default function IssueChecklistAddInput({
  placeholder,
  maxLength,
  onSubmit,
  onClose,
}: {
  placeholder: string;
  // Matches the API's own bound, so an over-long entry is stopped here rather
  // than coming back as a 400.
  maxLength: number;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    ref.current?.focus();
  }

  return (
    <Input
      ref={ref}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      className="h-8"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (!value.trim()) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
        if (e.key === 'Escape') onClose();
      }}
    />
  );
}
