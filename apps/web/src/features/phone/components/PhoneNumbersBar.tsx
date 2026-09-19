'use client';

import { Phone } from 'lucide-react';
import type { PhoneNumber } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export default function PhoneNumbersBar({ numbers }: { numbers: PhoneNumber[] }) {
  if (numbers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {numbers.map((number) => (
        <div
          key={number.id}
          className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
        >
          <Phone className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{number.number}</span>
          {number.label && <span className="text-sm text-muted-foreground">{number.label}</span>}
          {number.status !== 'ACTIVE' && <Badge variant="secondary">{number.status}</Badge>}
        </div>
      ))}
    </div>
  );
}
