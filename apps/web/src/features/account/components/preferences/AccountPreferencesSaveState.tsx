import { Loader2 } from 'lucide-react';

// Every choice on the preferences page saves as soon as it is made, so the page says
// "Saving…" while the request runs. The outcome is reported by a toast.
export default function AccountPreferencesSaveState({ saving }: { saving: boolean }) {
  if (!saving) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      Saving…
    </span>
  );
}
