import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

// A title input. Enter creates the issue and keeps the input open for the next
// one; Escape or leaving the input closes it.
export function QuickAddInput({
  onAdd,
  onClose,
  className,
}: {
  onAdd: (title: string) => Promise<void>;
  onClose: () => void;
  className?: string;
}) {
  const t = useTranslations('workItems');
  const tIssue = useTranslations('issue');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onAdd(value);
      setTitle('');
    } catch {
      // The MutationCache toasts the failure. The title stays for another try.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      autoFocus
      dir="auto"
      value={title}
      placeholder={tIssue('titlePlaceholder')}
      aria-label={t('addWorkItem')}
      aria-busy={saving}
      className={className}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit();
      }}
    />
  );
}
