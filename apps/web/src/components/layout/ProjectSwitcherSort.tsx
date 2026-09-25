import { ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectSort } from './utils/projectSwitcher';

export default function ProjectSwitcherSort({
  sort,
  onSortChange,
}: {
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
}) {
  const t = useTranslations('nav.projectPicker');

  return (
    <Select value={sort} onValueChange={(value) => onSortChange(value as ProjectSort)}>
      <SelectTrigger
        size="sm"
        className="shrink-0 gap-1.5 border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent dark:bg-transparent dark:hover:bg-accent"
        aria-label={t('sort')}
        title={t('sort')}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ArrowUpDown className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="key">{t('sortKey')}</SelectItem>
        <SelectItem value="name">{t('sortName')}</SelectItem>
        <SelectItem value="created">{t('sortCreated')}</SelectItem>
        <SelectItem value="activity" title={t('activityHint')}>
          {t('sortActivity')}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
