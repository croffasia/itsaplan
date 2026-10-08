import { useTranslations } from 'next-intl';

// A schedule type's name. The hosted build names the types it adds in its messages; on an
// instance without it, a schedule of one is listed by its id.
export function useScheduleTypeName() {
  const t = useTranslations('settings.schedules');
  return (id: string) => {
    const key = `types.${id}` as Parameters<typeof t.has>[0];
    return t.has(key) ? t(key) : id;
  };
}
