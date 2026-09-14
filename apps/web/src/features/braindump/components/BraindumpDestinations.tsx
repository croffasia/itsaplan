import { useState } from 'react';
import { Clock, Inbox, ListChecks } from 'lucide-react';
import type { BraindumpDestination } from '@/lib/api';
import { DESTINATION_META } from '../utils/braindump';
import BraindumpDestinationCard from './BraindumpDestinationCard';
import BraindumpScheduleDialog from './BraindumpScheduleDialog';

const ICONS = { obsidian: Inbox, issue: ListChecks, schedule: Clock } as const;

// Saves the draft and files it in one gesture. Only the schedule destination needs
// more input, so it opens a dialog first.
export default function BraindumpDestinations({
  projectKey,
  ready,
  obsidianAvailable,
  onSubmitTo,
}: {
  projectKey: string;
  ready: boolean;
  obsidianAvailable: boolean;
  onSubmitTo: (
    destination: BraindumpDestination,
    extra?: { agentId?: number; cron?: string },
  ) => void;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const destinations: BraindumpDestination[] = ['obsidian', 'issue', 'schedule'];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {destinations.map((destination) => {
          const meta = DESTINATION_META[destination];
          const unavailable = destination === 'obsidian' && !obsidianAvailable;
          return (
            <BraindumpDestinationCard
              key={destination}
              icon={ICONS[destination]}
              label={meta.label}
              target={unavailable ? 'Set OBSIDIAN_VAULT_DIR to enable' : meta.target}
              hint={meta.description}
              disabled={!ready || unavailable}
              onClick={() => {
                if (destination === 'schedule') setScheduleOpen(true);
                else onSubmitTo(destination);
              }}
            />
          );
        })}
      </div>

      <BraindumpScheduleDialog
        projectKey={projectKey}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onConfirm={(input) => {
          setScheduleOpen(false);
          onSubmitTo('schedule', input);
        }}
      />
    </>
  );
}
