import { useState } from 'react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A labelled read-only value with a copy button: the payload URL and secret the
// user pastes into GitHub's webhook form. `masked` hides the value until copied.
export default function GithubCopyField({
  label,
  value,
  masked = false,
  action,
}: {
  label: string;
  value: string;
  masked?: boolean;
  action?: ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          className="font-mono text-xs"
          value={masked && !revealed ? '•'.repeat(24) + value.slice(-4) : value}
          onFocus={() => setRevealed(true)}
        />
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          Copy
        </Button>
        {action}
      </div>
    </div>
  );
}
