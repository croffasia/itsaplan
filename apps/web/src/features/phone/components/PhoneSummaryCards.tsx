'use client';

import type { PhoneCalls } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '../utils/phone';

// The counters describe the calls currently listed, not the account as a whole, so
// changing a filter moves them with the table.
export default function PhoneSummaryCards({
  stats,
  newVoicemails,
}: {
  stats: PhoneCalls['stats'];
  newVoicemails: number;
}) {
  const cards = [
    { label: 'Calls shown', value: String(stats.total) },
    { label: 'Incoming', value: String(stats.inbound) },
    { label: 'Answered', value: String(stats.answered) },
    { label: 'Missed', value: String(stats.missed) },
    { label: 'Average length', value: formatDuration(stats.averageDuration) },
    { label: 'Unheard voicemail', value: String(newVoicemails) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="px-4 py-3">
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className="text-xl font-semibold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
