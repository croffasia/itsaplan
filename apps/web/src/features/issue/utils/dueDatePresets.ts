import { addDays } from '@/utils/dates';

// Due-date quick presets, resolved against today: tomorrow, the coming Friday
// (end of the work week), and one week out. The name of a preset is a message
// under `issue.dueDatePresets`; its resolved date is formatted by the caller.
export type DueDatePreset = 'tomorrow' | 'endOfWeek' | 'inOneWeek';

export function dueDatePresets(): { key: DueDatePreset; date: Date }[] {
  const today = new Date();
  const toFriday = (5 - today.getDay() + 7) % 7; // 0 when today is Friday
  return [
    { key: 'tomorrow', date: addDays(today, 1) },
    { key: 'endOfWeek', date: addDays(today, toFriday) },
    { key: 'inOneWeek', date: addDays(today, 7) },
  ];
}
