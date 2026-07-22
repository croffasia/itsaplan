import type { InitiativeHealth } from '@/lib/api';
import { healthMeta } from './initiativeMeta';

// A small health signal: a colored dot plus its label. null renders a muted
// "No update". Used in the list column and the detail header.
export default function HealthBadge({ health }: { health: InitiativeHealth | null }) {
  const { label, color } = healthMeta(health);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
