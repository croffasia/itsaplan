import { type ReactNode } from 'react';
import { Minus, SignalHigh, SignalLow, SignalMedium, TriangleAlert } from 'lucide-react';
import { PRIORITIES } from '@/utils/fieldOptions';

// Accent icon per priority value (plus the "unset" choice keyed by '').
const PRIORITY_ICON: Record<string, ReactNode> = {
  '': <Minus className="text-muted-foreground" />,
  urgent: <TriangleAlert style={{ color: 'var(--priority-urgent)' }} />,
  high: <SignalHigh style={{ color: 'var(--priority-high)' }} />,
  medium: <SignalMedium style={{ color: 'var(--priority-medium)' }} />,
  low: <SignalLow style={{ color: 'var(--priority-low)' }} />,
};

// Priority selector rows: the "No priority" choice first, then the canonical
// priorities, each with its accent icon. Value is the priority string, '' for
// none.
export const PRIORITY_FIELDS: { value: string; label: string; icon: ReactNode }[] = [
  { value: '', label: 'No priority', icon: PRIORITY_ICON[''] },
  ...PRIORITIES.map((p) => ({ value: p.value, label: p.label, icon: PRIORITY_ICON[p.value] })),
];
