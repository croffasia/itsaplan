'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelPriceRow } from '@/lib/api/endpoints/modelPrices';
import { useModelPriceCatalogQuery, useUsedModelPricesQuery } from '@/services/modelPrices.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import SettingsSection from '@/components/common/page/SettingsSection';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ListPager from '@/components/common/ListPager';
import SearchInput from '@/components/common/SearchInput';
import { usePaging } from '@/hooks/usePaging';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import ModelPriceDialog from './components/model-prices/ModelPriceDialog';
import ModelPriceTable from './components/model-prices/ModelPriceTable';

// The prices the workspace's dashboards cost model calls at. The models its agents use
// come first, those no price covers at the top; below them the whole built-in table,
// where any model can be given the price the workspace pays. Its owner and its admins
// open it, as they open the workspace's dashboard.
export default function WorkspaceModelPricesSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace.modelPrices');
  const used = useUsedModelPricesQuery(workspaceId).data;
  const paging = usePaging();
  const { search, setSearch, term } = useSearchTerm();
  const catalog = useModelPriceCatalogQuery(workspaceId, paging.params, term).data;
  const [editing, setEditing] = useState<ModelPriceRow | null>(null);
  const unpriced = used?.filter((row) => !row.own && !row.builtIn).length ?? 0;

  return (
    <SectionPageView title={t('title')} description={t('description')} wide>
      <div className="space-y-10">
        <SettingsSection title={t('used.title')} description={t('used.description')}>
          {unpriced > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
              {t('used.unpriced', { count: unpriced })}
            </p>
          )}
          {!used ? (
            <ListSkeleton rows={3} rowClassName="h-12" />
          ) : used.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('used.empty')}</p>
          ) : (
            <ModelPriceTable rows={used} onEdit={setEditing} />
          )}
        </SettingsSection>

        <SettingsSection
          title={t('all.title')}
          description={t('all.description')}
          action={
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                paging.reset();
              }}
              placeholder={t('all.search')}
              className="w-60"
            />
          }
        >
          {!catalog ? (
            <ListSkeleton rows={5} rowClassName="h-12" />
          ) : catalog.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('all.noMatch', { query: term ?? '' })}
            </p>
          ) : (
            <ModelPriceTable rows={catalog.items} onEdit={setEditing} />
          )}
          {catalog && catalog.total > 0 && <ListPager paging={paging} total={catalog.total} />}
        </SettingsSection>
      </div>

      {editing && (
        <ModelPriceDialog
          workspaceId={workspaceId}
          row={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionPageView>
  );
}
