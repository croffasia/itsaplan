import { TriangleAlert } from 'lucide-react';

// What a pending change will do to the values issues already hold.
export default function FieldChangeWarning({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning/15 px-2.5 py-2 text-xs">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
      {children}
    </p>
  );
}
