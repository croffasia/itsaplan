'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePhoneRecordingQuery, useSetPhoneRecording } from '../services/phone.service';

// With recording off, Rinkel keeps no audio of a call at all, so the call list can
// never offer a recording. That is worth saying on the page rather than leaving
// someone to wonder why the play buttons never appear.
export default function PhoneRecordingToggle({
  projectKey,
  numberId,
  canEdit,
}: {
  projectKey: string;
  numberId: string;
  canEdit: boolean;
}) {
  const settings = usePhoneRecordingQuery(projectKey, numberId);
  const setRecording = useSetPhoneRecording(projectKey, numberId);

  if (!settings.data) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <Switch
        id="phone-recording"
        checked={settings.data.enabled}
        disabled={!canEdit || setRecording.isPending}
        onCheckedChange={(checked) => setRecording.mutate(checked)}
      />
      <div>
        <Label htmlFor="phone-recording" className="text-sm">
          Record calls
        </Label>
        <p className="text-xs text-muted-foreground">
          {settings.data.enabled
            ? 'New calls are recorded and playable here.'
            : 'Off, so no call has audio to play.'}
        </p>
      </div>
    </div>
  );
}
