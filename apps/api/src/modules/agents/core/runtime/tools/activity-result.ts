import type { ActivityPage } from '#modules/analytics/service';

export function compactProjectActivity(page: ActivityPage) {
  return {
    ...page,
    items: page.items.map((item) => {
      const truncatedFields: { field: string; originalLength: number }[] = [];
      const preview = (value: string | null, field: string) => {
        if (value === null || value.length <= 1000) return value;
        truncatedFields.push({ field, originalLength: value.length });
        return value.slice(0, 1000).replace(/[\uD800-\uDBFF]$/, '');
      };

      const body = preview(item.body, 'body');
      const payload = { ...item.payload };
      for (const side of ['subject', 'from', 'to'] as const) {
        const value = payload[side];
        if (value) {
          payload[side] = { ...value, value: preview(value.value, `payload.${side}.value`) };
        }
      }

      if (truncatedFields.length === 0) return item;
      return { ...item, body, payload, truncatedFields };
    }),
  };
}
