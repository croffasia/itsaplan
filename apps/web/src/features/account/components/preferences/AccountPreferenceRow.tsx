'use client';

import type { ReactNode } from 'react';

// One preference: its name, a short explanation, and the control that changes it.
// The control sits in a column of fixed width, so every control on the page lines
// up however long the text beside it runs. On a narrow screen the control drops
// under the text instead of squeezing it.
export default function AccountPreferenceRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 sm:w-44 sm:justify-end">{children}</div>
    </div>
  );
}
