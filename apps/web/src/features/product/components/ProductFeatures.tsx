import { getTranslations } from 'next-intl/server';
import {
  BoardIcon,
  CycleIcon,
  DocsIcon,
  NotesIcon,
  DashboardIcon,
  ChatIcon,
  MentionIcon,
  TeamIcon,
  WorkspaceIcon,
  ScheduleIcon,
  BudgetIcon,
  TranslateIcon,
} from '@/components/brand/icons';
import ProductSection from './ProductSection';

const ITEMS = [
  { key: 'board', Icon: BoardIcon },
  { key: 'cycle', Icon: CycleIcon },
  { key: 'docs', Icon: DocsIcon },
  { key: 'notes', Icon: NotesIcon },
  { key: 'dashboard', Icon: DashboardIcon },
  { key: 'chat', Icon: ChatIcon },
  { key: 'mention', Icon: MentionIcon },
  { key: 'team', Icon: TeamIcon },
  { key: 'workspace', Icon: WorkspaceIcon },
  { key: 'schedule', Icon: ScheduleIcon },
  { key: 'budget', Icon: BudgetIcon },
  { key: 'translate', Icon: TranslateIcon },
] as const;

export default async function ProductFeatures() {
  const t = await getTranslations('product.features');
  return (
    <ProductSection id="features" title={t('title')}>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {ITEMS.map(({ key, Icon }) => (
          <li key={key} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Icon className="shrink-0 text-brand-teal dark:text-brand-mint" />
            <span className="font-medium">{t(`items.${key}`)}</span>
          </li>
        ))}
      </ul>
    </ProductSection>
  );
}
