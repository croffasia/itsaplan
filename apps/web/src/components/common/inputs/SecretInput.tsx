import { useState } from 'react';
import { CircleCheck, CircleX, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// A masked input for a secret (SMTP password, API key, bot token). The stored value
// is never sent to the client, so the field starts empty: when a value is already
// saved, the placeholder shows dots and leaving the field blank keeps the stored
// secret. An eye toggle reveals what the user is typing. A checked value shows a green
// check mark when it was accepted and a red cross when it was not.
export default function SecretInput({
  id,
  value,
  onChange,
  hasStored,
  placeholder,
  status,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hasStored: boolean;
  placeholder?: string;
  status?: 'valid' | 'invalid';
}) {
  const t = useTranslations('common');
  const [reveal, setReveal] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasStored ? '••••••••••••' : placeholder}
        aria-invalid={status === 'invalid' || undefined}
        className={cn(status ? 'pe-16' : 'pe-9')}
        // Browsers ignore "off" on a password field and fill the account's own login
        // into it; "new-password" is the value they respect.
        autoComplete="new-password"
      />
      {status === 'valid' && (
        <CircleCheck className="pointer-events-none absolute inset-y-0 end-10 my-auto size-4 text-emerald-600 dark:text-emerald-400" />
      )}
      {status === 'invalid' && (
        <CircleX className="pointer-events-none absolute inset-y-0 end-10 my-auto size-4 text-destructive-text" />
      )}
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={reveal ? t('hide') : t('show')}
        tabIndex={-1}
      >
        {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
