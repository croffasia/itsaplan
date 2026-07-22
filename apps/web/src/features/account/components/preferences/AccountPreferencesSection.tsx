import type { ReactNode } from 'react';

// A group of related preferences: a heading over an optional explanation, then the
// rows themselves. Groups are separated by space and a rule, the way the Profile
// page separates its blocks; the rows carry no box of their own, so every control
// lines up down the page instead of sitting in stacked cards.
export default function AccountPreferencesSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-8 first:border-t-0 first:pt-0">
      <div className="mb-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}
