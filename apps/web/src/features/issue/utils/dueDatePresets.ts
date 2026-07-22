import { addDays } from '@/utils/dates';

// "Thu, Jul 9" for a due-date preset's resolved date.
export function formatPreset(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Due-date quick presets, resolved against today: tomorrow, the coming Friday
// (end of the work week), and one week out.
export function dueDatePresets(): { key: string; label: string; date: Date }[] {
  const today = new Date();
  const toFriday = (5 - today.getDay() + 7) % 7; // 0 when today is Friday
  return [
    { key: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
    { key: 'end-of-week', label: 'End of this week', date: addDays(today, toFriday) },
    { key: 'one-week', label: 'In one week', date: addDays(today, 7) },
  ];
}
