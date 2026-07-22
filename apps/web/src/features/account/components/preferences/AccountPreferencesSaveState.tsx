'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

// Every choice on the preferences page saves as soon as it is made, so the page
// says so: "Saving…" while the request runs, then "Saved" for a few seconds. A
// failed save raises the app's error toast, so nothing is reported twice here.
export default function AccountPreferencesSaveState({
  saving,
  savedAt,
}: {
  saving: boolean;
  // Timestamp of the last successful save, or null before the first one.
  savedAt: number | null;
}) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (savedAt == null) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [savedAt]);

  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (!showSaved) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="size-3.5" />
      Saved
    </span>
  );
}
