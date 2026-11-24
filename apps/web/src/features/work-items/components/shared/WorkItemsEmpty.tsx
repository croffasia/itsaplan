import { useTranslations } from 'next-intl';
import { isActiveFilterSet, type FilterSet } from '@/utils/filters';
import { EmptyState } from '@/components/common/page/EmptyState';

export function WorkItemsEmpty({ filters }: { filters: FilterSet }) {
  const t = useTranslations('workItems.empty');
  const filtered = isActiveFilterSet(filters);
  return (
    <div className="flex h-full flex-col">
      <EmptyState
        title={filtered ? t('filteredTitle') : t('title')}
        description={filtered ? t('filteredDescription') : t('description')}
      />
    </div>
  );
}
