'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type WorklogInput } from '@/lib/api';
import { toDateStr } from '@/utils/dates';
import { parseMinutes, formatMinutes } from '@/utils/estimate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePill from '@/components/common/fields/DatePill';

const NOTE_MAX = 500;

// The form behind a time entry, used both for a new one and for changing one that
// is there. The time is typed the way the estimate is ('1h 30m'), and text it
// cannot read leaves the form open. The day defaults to today and the calendar
// offers no later one, which is also what the API accepts.
export default function IssueWorklogForm({
  entry,
  saving,
  onSubmit,
  onCancel,
}: {
  // The entry being changed, or undefined for a new one.
  entry?: { minutes: number; spentOn: string; note: string | null };
  saving: boolean;
  onSubmit: (input: WorklogInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('issue.worklog');
  const tCommon = useTranslations('common');
  const [time, setTime] = useState(entry ? formatMinutes(entry.minutes) : '');
  const [spentOn, setSpentOn] = useState(entry?.spentOn ?? toDateStr(new Date()));
  const [note, setNote] = useState(entry?.note ?? '');

  // Text the parser cannot read and a typed zero both come out as no time, which is
  // not an entry.
  const minutes = parseMinutes(time) ?? 0;

  function submit() {
    if (minutes <= 0) return;
    onSubmit({ minutes, spentOn, note: note.trim() || null });
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          value={time}
          placeholder={t('timePlaceholder')}
          aria-label={t('time')}
          className="h-8 w-28"
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <DatePill
          value={spentOn}
          onChange={(value) => value && setSpentOn(value)}
          clearable={false}
          disabled={{ after: new Date() }}
        />
        <Input
          value={note}
          placeholder={t('notePlaceholder')}
          aria-label={t('note')}
          maxLength={NOTE_MAX}
          className="h-8 min-w-40 flex-1"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button size="sm" disabled={minutes <= 0 || saving} onClick={submit}>
          {tCommon('save')}
        </Button>
      </div>
    </div>
  );
}
