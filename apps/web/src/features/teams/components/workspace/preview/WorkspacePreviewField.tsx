'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspacePreviewField({
  label,
  hint,
  tall = false,
}: {
  label: string;
  hint?: string;
  tall?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <Skeleton className={tall ? 'h-24' : 'h-9'} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
