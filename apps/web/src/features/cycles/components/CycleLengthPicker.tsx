'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CYCLE_LENGTHS } from '../utils/cycleDefaults';

// The cycle length as one click per common option, so the end date rarely has to be
// picked by hand. `days` is the length the two dates currently span, which
// highlights the matching option and stays unhighlighted for a hand-picked range.
export default function CycleLengthPicker({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  const t = useTranslations('cycles');

  return (
    <div className="flex items-center gap-1.5">
      {CYCLE_LENGTHS.map((length) => (
        <Button
          key={length}
          type="button"
          size="sm"
          variant={days === length ? 'secondary' : 'outline'}
          className="h-7 px-2.5 text-xs font-normal"
          onClick={() => onChange(length)}
        >
          {t('weeks', { count: length / 7 })}
        </Button>
      ))}
    </div>
  );
}
