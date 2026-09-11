import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

export default function SettingsWarningBanner({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning/15 px-2.5 py-2 text-xs">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
      {children}
    </p>
  );
}
