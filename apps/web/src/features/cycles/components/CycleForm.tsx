'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ApiError, type Cycle } from '@/lib/api';
import { addDays, daysBetween, parseDate, toDateStr } from '@/utils/dates';
import Modal from '@/components/common/overlay/Modal';
import DatePill from '@/components/common/fields/DatePill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCycle, useUpdateCycle } from '@/services/cycles.service';
import type { CycleDefaults } from '../utils/cycleDefaults';
import { busyRanges, endLimit } from '../utils/cycleRanges';
import CycleLengthPicker from './CycleLengthPicker';
import FixedDate from './FixedDate';

// The fields of a cycle: name, goal, and the range. A new cycle opens already filled
// in from `defaults`, so creating one takes a single click. The API rejects dates
// that overlap another cycle; that message is shown as it comes back.
export default function CycleForm({
  projectKey,
  cycle,
  cycles,
  defaults,
  onClose,
}: {
  projectKey: string;
  cycle?: Cycle;
  // The project's cycles, which the new range has to fit around.
  cycles: Cycle[];
  defaults: CycleDefaults;
  onClose: () => void;
}) {
  const t = useTranslations('cycles');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(cycle?.name ?? defaults.name);
  const [goal, setGoal] = useState(cycle?.goal ?? '');
  const [startDate, setStartDate] = useState(cycle?.startDate ?? defaults.startDate);
  const [endDate, setEndDate] = useState(cycle?.endDate ?? defaults.endDate);
  const create = useCreateCycle(projectKey);
  const update = useUpdateCycle(projectKey);
  const saving = create.isPending || update.isPending;

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const length = start && end ? daysBetween(start, end) + 1 : 0;

  const busy = busyRanges(cycles, cycle?.id);
  const lastDay = endLimit(cycles, startDate, cycle?.id);

  // How far the dates may still move, matching what the API accepts: a running cycle
  // can only be cut short or extended, a finished one is a record and keeps both
  // dates. The name and the goal stay editable either way.
  const startLocked = cycle !== undefined && cycle.status !== 'upcoming';
  const endLocked = cycle?.status === 'completed';

  // A range may not run into the cycle that follows it, so an end computed from a
  // length stops at the day before that one starts.
  const endFrom = (from: Date, days: number): string => {
    const limit = endLimit(cycles, toDateStr(from), cycle?.id);
    const candidate = addDays(from, days - 1);
    return toDateStr(limit && candidate > limit ? limit : candidate);
  };

  // Both dates move together: changing the length or the start keeps the span, so
  // only the end date is ever picked by hand.
  const changeLength = (days: number) => {
    if (start) setEndDate(endFrom(start, days));
  };
  const changeStart = (next: string) => {
    setStartDate(next);
    const from = parseDate(next);
    if (from && length > 0) setEndDate(endFrom(from, length));
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = { name: trimmed, goal: goal.trim(), startDate, endDate };
    try {
      if (cycle) await update.mutateAsync({ id: cycle.id, patch: input });
      else await create.mutateAsync(input);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('form.saveFailed'));
    }
  };

  return (
    <Modal
      title={cycle ? t('form.editTitle') : t('form.newTitle')}
      projectKey={projectKey}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cycle-name">{t('form.name')}</Label>
          <Input
            id="cycle-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && void submit()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cycle-goal">{t('form.goal')}</Label>
          <Textarea
            id="cycle-goal"
            value={goal}
            placeholder={t('form.goalPlaceholder')}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        {!endLocked && (
          <div className="flex flex-col gap-1.5">
            <Label>{t('form.length')}</Label>
            <CycleLengthPicker days={length} onChange={changeLength} />
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('form.starts')}</Label>
            {startLocked ? (
              <FixedDate value={startDate} />
            ) : (
              <DatePill
                value={startDate}
                clearable={false}
                disabled={busy}
                onChange={(v) => v && changeStart(v)}
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('form.ends')}</Label>
            {endLocked ? (
              <FixedDate value={endDate} />
            ) : (
              <DatePill
                value={endDate}
                clearable={false}
                disabled={[
                  ...(start ? [{ before: start }] : []),
                  ...(lastDay ? [{ after: lastDay }] : []),
                ]}
                onChange={(v) => v && setEndDate(v)}
              />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button disabled={!name.trim() || saving} onClick={() => void submit()}>
            {saving ? tCommon('saving') : cycle ? tCommon('save') : t('form.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
